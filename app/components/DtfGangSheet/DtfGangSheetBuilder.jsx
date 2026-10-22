import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useFetcher, useNavigate, useSearchParams} from 'react-router';
import {createPortal} from 'react-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  BrushCleaning,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Info,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Maximize2,
  Palette,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DTF_GANG_SHEET_PRODUCT_HANDLE,
  DTF_GANG_SHEET_SIZES,
  findGangSheetVariant,
} from '~/lib/dtfSheetConstants';
import {
  composeGangSheetPreview,
  dtfImageProxyUrl,
  fetchImageAsDataUrl,
  getGangSheetRemote,
  remoteGangSheetToSaved,
  saveGangSheetRemote,
} from '~/lib/dtfGangSheetApi';
import {buildGangSheetLineAttributes} from '~/lib/dtfGangSheetOrderAttributes';
import {
  getDesignApiBaseUrl,
  removeEdgeBackground,
} from '~/lib/designStudioApi';
import {
  BUILD_PX_PER_IN,
  BUILD_ZOOM_MAX,
  BUILD_ZOOM_MIN,
  MAX_IN,
  MIN_IN,
  SIZE_PRESETS,
  buildRulerTicks,
  clamp,
  computePrintSize,
  designSizes,
  detectSolidBackground,
  estimateDpi,
  findNextPlacement,
  getActiveSize,
  loadImageDims,
  makeDesignSize,
  packGangSheetItems,
  gangSheetHasOverlaps,
  readFileAsDataUrl,
  recommendedPrintLongerSide,
  suggestedLongerSideForDpi,
  upscaleImageToPrintDpi,
} from '~/lib/dtfGangSheetHelpers';
import {AddImagesModal} from '~/components/DtfGangSheet/modals/AddImagesModal';
import {NamesNumbersModal} from '~/components/DtfGangSheet/modals/NamesNumbersModal';
import {AutoBuildModal} from '~/components/DtfGangSheet/modals/AutoBuildModal';
import {UploadProgressModal} from '~/components/DtfGangSheet/modals/UploadProgressModal';
import {BackgroundDetectModal} from '~/components/DtfGangSheet/modals/BackgroundDetectModal';
import {RemoveBgCompareModal} from '~/components/DtfGangSheet/modals/RemoveBgCompareModal';
import {ConfirmOrderModal} from '~/components/DtfGangSheet/modals/ConfirmOrderModal';
import {AddingToCartModal} from '~/components/DtfGangSheet/modals/AddingToCartModal';

/**
 * @typedef {{
 *   id: string;
 *   longerSideIn: number;
 *   qty: number;
 * }} DesignSize
 */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   fileName: string;
 *   imageDataUrl: string;
 *   originalDataUrl: string;
 *   naturalWidth: number;
 *   naturalHeight: number;
 *   sizes: DesignSize[];
 *   activeSizeId: string;
 *   bgRemoved: boolean;
 * }} GalleryDesign
 */

/**
 * @typedef {{
 *   id: string;
 *   designId: string;
 *   sizeId?: string;
 *   label: string;
 *   imageDataUrl: string;
 *   widthIn: number;
 *   heightIn: number;
 *   x: number;
 *   y: number;
 *   rotation: number;
 *   flipH?: boolean;
 *   flipV?: boolean;
 * }} PlacedItem
 */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   fileName: string;
 *   originalDataUrl: string;
 *   imageDataUrl: string;
 *   naturalWidth: number;
 *   naturalHeight: number;
 *   bgHex: string | null;
 *   needsBgReview: boolean;
 * }} PendingUpload
 */

/**
 * Unified DTFSheet-style gang sheet studio:
 * left gallery · center canvas · right summary
 * Upload → progress → bg detect → compare → gallery → add to canvas
 *
 * @param {{
 *   product: {
 *     id?: string;
 *     handle?: string;
 *     title?: string;
 *     variants?: { nodes?: Array<{
 *       id: string;
 *       title: string;
 *       availableForSale?: boolean;
 *       price?: { amount: string; currencyCode?: string };
 *     }> };
 *   } | null;
 * }} props
 */
export function DtfGangSheetBuilder({product}) {
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const inputId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const cartFetcher = useFetcher({key: 'dtf-gang-sheet-cart'});

  const initialSize = searchParams.get('size') || DTF_GANG_SHEET_SIZES[0].id;
  const initialQty = Math.max(1, Number(searchParams.get('qty')) || 1);
  const startWithUpload = searchParams.get('mode') === 'upload';
  const editGangSheetId = searchParams.get('gangSheetId');
  const editCartLineId = searchParams.get('cartLine');
  const editDesignName = searchParams.get('name');
  /** Reopen studio from cart — cart line id enables Update Sheet. */
  const isEditMode = Boolean(editGangSheetId);
  const canUpdateCartLine = Boolean(editGangSheetId && editCartLineId);

  const [sheetId, setSheetId] = useState(initialSize);
  const [orderQty] = useState(initialQty);
  const [addOpen, setAddOpen] = useState(startWithUpload && !isEditMode);
  const [namesOpen, setNamesOpen] = useState(false);
  const [autoBuildOpen, setAutoBuildOpen] = useState(false);
  const [tidying, setTidying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [designName, setDesignName] = useState(editDesignName || '');
  const [confirmPreview, setConfirmPreview] = useState(
    /** @type {string | null} */ (null),
  );
  const [addProgress, setAddProgress] = useState({
    completedSteps: 0,
    percent: 0,
    error: /** @type {string | null} */ (null),
  });
  const addToCartInFlightRef = useRef(false);
  const cartSubmitSeenRef = useRef(false);
  const cartRedirectScheduledRef = useRef(false);
  const editBaselineRef = useRef(/** @type {string | null} */ (null));
  const [sheetDirty, setSheetDirty] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);
  const [updateMode, setUpdateMode] = useState(false);
  const sheet = useMemo(
    () =>
      DTF_GANG_SHEET_SIZES.find((s) => s.id === sheetId) ||
      DTF_GANG_SHEET_SIZES[0],
    [sheetId],
  );

  const [designs, setDesigns] = useState(/** @type {GalleryDesign[]} */ ([]));
  const [placed, setPlaced] = useState(/** @type {PlacedItem[]} */ ([]));
  const [selectedId, setSelectedId] = useState(
    /** @type {string | null} */ (null),
  );
  /** Keeps drawer content mounted through the close slide-out. */
  const [drawerPayload, setDrawerPayload] = useState(
    /** @type {{ design: GalleryDesign; placed: PlacedItem } | null} */ (null),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [savedRemoteId, setSavedRemoteId] = useState(
    /** @type {string | null} */ (null),
  );
  const [previewUrl, setPreviewUrl] = useState(
    /** @type {string | null} */ (null),
  );
  const [zoom, setZoom] = useState(1);
  const [canvasSizeOpen, setCanvasSizeOpen] = useState(false);
  const canvasSizeRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [clearCanvasOpen, setClearCanvasOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const dragRef = useRef(
    /** @type {{ id: string; startX: number; startY: number; ox: number; oy: number; widthIn: number; heightIn: number } | null} */ (
      null
    ),
  );
  const resizeRef = useRef(
    /** @type {{
     *   id: string;
     *   designId: string;
     *   aspect: number;
     *   corner: 'nw' | 'ne' | 'sw' | 'se';
     *   fixedX: number;
     *   fixedY: number;
     *   signX: number;
     *   signY: number;
     * } | null} */ (null),
  );
  const sheetElRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  /** Only clear selection when the pointer interaction started on empty sheet. */
  const sheetClickClearsRef = useRef(false);

  /* Upload / bg-review flow */
  const [uploadRows, setUploadRows] = useState(
    /** @type {Array<{ id: string; name: string; previewUrl?: string | null; progress: number; status: string }>} */ (
      []
    ),
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingQueue, setPendingQueue] = useState(
    /** @type {PendingUpload[]} */ ([]),
  );
  const [activePending, setActivePending] = useState(
    /** @type {PendingUpload | null} */ (null),
  );
  const [detectOpen, setDetectOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cleanedPreview, setCleanedPreview] = useState(
    /** @type {string | null} */ (null),
  );
  const [bgBusy, setBgBusy] = useState(false);
  const [upscaleBusy, setUpscaleBusy] = useState(false);

  const variantIdParam = searchParams.get('variant');
  // Always price/ATC from the *current* canvas size. The URL ?variant= is only
  // an entry hint — if we kept locking to it, resizing 7ft → 2ft still checked out 7ft.
  const variant = useMemo(() => {
    const nodes = product?.variants?.nodes || [];
    const bySheet = findGangSheetVariant(nodes, sheet);
    if (bySheet) return bySheet;
    if (variantIdParam) {
      const byId = nodes.find((v) => v.id === variantIdParam);
      if (byId) return byId;
    }
    return nodes[0] || null;
  }, [product, sheet, variantIdParam]);

  const priceLabel = variant?.price?.amount
    ? `$${Number(variant.price.amount).toFixed(2)}`
    : `$${Number(sheet.defaultPrice).toFixed(2)}`;

  /**
   * Snapshot of sheet state for dirty detection in cart-edit mode.
   * @param {PlacedItem[]} items
   * @param {string} sizeId
   * @param {string} name
   */
  function sheetFingerprint(items, sizeId, name) {
    return JSON.stringify({
      sizeId,
      name: String(name || '').trim(),
      items: items.map((p) => ({
        id: p.id,
        designId: p.designId,
        x: Number(p.x.toFixed(4)),
        y: Number(p.y.toFixed(4)),
        w: Number(p.widthIn.toFixed(3)),
        h: Number(p.heightIn.toFixed(3)),
        r: Math.round(p.rotation || 0),
        flipH: Boolean(p.flipH),
        flipV: Boolean(p.flipV),
        img: p.imageDataUrl ? p.imageDataUrl.length : 0,
      })),
    });
  }

  useEffect(() => {
    if (!isEditMode || !editGangSheetId) {
      setLoadingEdit(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingEdit(true);
      setError(null);
      try {
        const remoteRaw = await getGangSheetRemote(editGangSheetId);
        if (cancelled) return;
        if (!remoteRaw) {
          setError('Could not load this gang sheet for editing.');
          return;
        }
        const saved = remoteGangSheetToSaved(remoteRaw);
        if (saved.sheetSize) setSheetId(String(saved.sheetSize));
        const name =
          editDesignName ||
          saved.designName ||
          `Gang Sheet ${saved.sheetSize || ''}`.trim();
        setDesignName(name);
        setSavedRemoteId(saved.remoteId);
        setPreviewUrl(saved.previewUrl || null);

        /** @type {GalleryDesign[]} */
        const nextDesigns = [];
        /** @type {PlacedItem[]} */
        const nextPlaced = [];
        const remoteItems = saved.items || [];
        /** Reuse one gallery design for identical art so On Sheet groups by qty. */
        /** @type {Map<string, { design: GalleryDesign; sizeId: string }>} */
        const designByKey = new Map();

        /**
         * @param {string} dataUrl
         * @param {string | null | undefined} savedDesignId
         */
        function groupKeyForArt(dataUrl, savedDesignId) {
          if (savedDesignId) return `id:${savedDesignId}`;
          const s = String(dataUrl);
          const b64 = s.includes(',') ? s.slice(s.indexOf(',') + 1) : s;
          return `img:${b64.length}:${b64.slice(0, 64)}:${b64.slice(-48)}`;
        }

        for (const item of remoteItems) {
          if (cancelled) return;
          const src = item.imageUrl || item.imageDataUrl;
          if (!src) continue;

          // Always convert to a data URL (via same-origin proxy if needed) so
          // canvas export / upscale never hits a tainted-canvas error.
          let displaySrc = await fetchImageAsDataUrl(String(src));
          if (cancelled) return;
          if (!displaySrc) {
            const proxy = dtfImageProxyUrl(String(src));
            displaySrc = (await fetchImageAsDataUrl(proxy)) || null;
          }
          if (cancelled) return;
          if (!displaySrc) {
            console.warn('[dtf] could not materialize image for edit', item.id);
            continue;
          }

          let dims = {w: 500, h: 500};
          try {
            dims = await loadImageDims(displaySrc);
          } catch {
            try {
              dims = await loadImageDims(String(src));
            } catch {
              /* keep defaults */
            }
          }
          if (cancelled) return;

          const t = item.transform || {x: 0.5, y: 0.5, scale: 0.2, rotation: 0};
          const widthIn =
            item.widthIn != null
              ? Number(item.widthIn)
              : Math.max(MIN_IN, t.scale * (saved.sheetWidthIn || 22));
          const heightIn =
            item.heightIn != null
              ? Number(item.heightIn)
              : Math.max(MIN_IN, widthIn * (dims.h / Math.max(dims.w, 1)));
          const longer = Math.max(widthIn, heightIn, MIN_IN);
          const label = item.label || 'Art';
          const key = groupKeyForArt(displaySrc, item.designId);
          let entry = designByKey.get(key);

          if (!entry) {
            const designId = item.designId || `d-edit-${nextDesigns.length + 1}`;
            const size = makeDesignSize(Number(longer.toFixed(2)), 1);
            /** @type {GalleryDesign} */
            const design = {
              id: designId,
              label,
              fileName: `${label}.png`,
              imageDataUrl: displaySrc,
              originalDataUrl: displaySrc,
              naturalWidth: dims.w,
              naturalHeight: dims.h,
              sizes: [size],
              activeSizeId: size.id,
              bgRemoved: false,
            };
            entry = {design, sizeId: size.id};
            designByKey.set(key, entry);
            nextDesigns.push(design);
          } else {
            // Same art at a different print size → add a size preset on the design.
            const existing = entry.design.sizes.find(
              (s) => Math.abs(s.longerSideIn - longer) < 0.05,
            );
            if (existing) {
              entry = {...entry, sizeId: existing.id};
            } else {
              const size = makeDesignSize(Number(longer.toFixed(2)), 1);
              entry.design.sizes = [...entry.design.sizes, size];
              entry = {...entry, sizeId: size.id};
              designByKey.set(key, entry);
            }
          }

          nextPlaced.push({
            id: item.id || `${entry.design.id}-p-${nextPlaced.length}`,
            designId: entry.design.id,
            sizeId: entry.sizeId,
            label,
            imageDataUrl: entry.design.imageDataUrl,
            widthIn,
            heightIn,
            x: Number(t.x) || 0.5,
            y: Number(t.y) || 0.5,
            rotation: Number(t.rotation) || 0,
            flipH: Boolean(/** @type {{ flipH?: boolean }} */ (t).flipH),
            flipV: Boolean(/** @type {{ flipV?: boolean }} */ (t).flipV),
          });
        }

        if (cancelled) return;

        if (!nextPlaced.length) {
          setDesigns([]);
          setPlaced([]);
          setError(
            remoteItems.length
              ? 'Could not load artwork for this gang sheet. Check your connection and try Edit again.'
              : 'This gang sheet has no artwork saved yet.',
          );
          return;
        }

        setDesigns(nextDesigns);
        // Pack immediately on hydrate — calling tidyCanvasAsync from this
        // async effect races React Strict Mode / stale closures and often
        // never lands. Size-change tidy works because it runs from a click.
        const sheetW = Number(saved.sheetWidthIn) || 22;
        const sheetH = Number(saved.sheetHeightIn) || 24;
        const placements = packGangSheetItems({
          sheetWidthIn: sheetW,
          sheetHeightIn: sheetH,
          items: nextPlaced.map((p) => ({
            id: p.id,
            widthIn: p.widthIn,
            heightIn: p.heightIn,
          })),
          canvasMarginIn: 0,
          imageMarginIn: 0.25,
          tidy: true,
        });
        const tidied = nextPlaced.map((p) => {
          const pos = placements.get(p.id);
          if (!pos) return {...p, rotation: 0};
          return {...p, x: pos.x, y: pos.y, rotation: 0};
        });
        setPlaced(tidied);
        editBaselineRef.current = sheetFingerprint(
          tidied,
          saved.sheetSize || sheetId,
          name,
        );
        setSheetDirty(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Failed to load gang sheet',
          );
        }
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once per edit target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editGangSheetId]);

  useEffect(() => {
    if (!isEditMode || !editBaselineRef.current || loadingEdit) return;
    const fp = sheetFingerprint(placed, sheetId, designName);
    setSheetDirty(fp !== editBaselineRef.current);
  }, [isEditMode, loadingEdit, placed, sheetId, designName]);

  const selected = placed.find((p) => p.id === selectedId) || null;
  const selectedDesign = selected
    ? designs.find((d) => d.id === selected.designId) || null
    : null;

  useEffect(() => {
    if (!selectedId) {
      setDrawerOpen(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  useEffect(() => {
    if (selected && selectedDesign) {
      setDrawerPayload({design: selectedDesign, placed: selected});
    }
  }, [selected, selectedDesign]);

  const coveragePct = useMemo(() => {
    const area = placed.reduce((n, p) => n + p.widthIn * p.heightIn, 0);
    const sheetArea = sheet.widthIn * sheet.heightIn;
    return Math.min(100, Math.round((area / Math.max(sheetArea, 0.01)) * 100));
  }, [placed, sheet.heightIn, sheet.widthIn]);

  /** Unique designs on the sheet with qty (for the right-rail list). */
  const sheetGroups = useMemo(() => {
    /** @type {Map<string, PlacedItem[]>} */
    const map = new Map();
    for (const p of placed) {
      const list = map.get(p.designId) || [];
      list.push(p);
      map.set(p.designId, list);
    }
    return [...map.entries()].map(([designId, items]) => {
      const sample = items[0];
      const design = designs.find((d) => d.id === designId);
      const label = (design?.label || sample.label || 'Art').replace(
        /\s*\(\d+\)\s*$/,
        '',
      );
      const dpi = estimateDpi(
        {
          naturalWidth: design?.naturalWidth || 1,
          naturalHeight: design?.naturalHeight || 1,
        },
        {widthIn: sample.widthIn, heightIn: sample.heightIn},
      );
      return {
        designId,
        items,
        sample,
        label,
        imageDataUrl: sample.imageDataUrl,
        widthIn: sample.widthIn,
        heightIn: sample.heightIn,
        qty: items.length,
        dpi,
        isActive: items.some((i) => i.id === selectedId),
      };
    });
  }, [placed, designs, selectedId]);

  useEffect(() => {
    if (!canvasSizeOpen) return;
    const onPointer = (e) => {
      if (!canvasSizeRef.current?.contains(/** @type {Node} */ (e.target))) {
        setCanvasSizeOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setCanvasSizeOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [canvasSizeOpen]);

  const sheetMaxIn = Math.min(sheet.widthIn, sheet.heightIn);

  /**
   * @param {GalleryDesign} design
   */
  function commitDesign(design) {
    setDesigns((prev) => {
      const exists = prev.some((d) => d.id === design.id);
      return exists
        ? prev.map((d) => (d.id === design.id ? design : d))
        : [...prev, design];
    });
  }

  /**
   * @param {PendingUpload} pending
   * @param {{ cleanedUrl?: string; bgRemoved?: boolean }} [opts]
   */
  async function finalizePending(pending, opts = {}) {
    let imageDataUrl = opts.cleanedUrl || pending.imageDataUrl;
    let naturalWidth = pending.naturalWidth;
    let naturalHeight = pending.naturalHeight;
    if (opts.cleanedUrl) {
      try {
        const dims = await loadImageDims(opts.cleanedUrl);
        naturalWidth = dims.w;
        naturalHeight = dims.h;
      } catch {
        /* keep pending dims */
      }
    }
    const longer = recommendedPrintLongerSide(
      {naturalWidth, naturalHeight},
      sheetMaxIn,
    );
    const size = makeDesignSize(longer);
    /** @type {GalleryDesign} */
    const design = {
      id: pending.id,
      label: pending.label,
      fileName: pending.fileName,
      imageDataUrl,
      originalDataUrl: pending.originalDataUrl,
      naturalWidth,
      naturalHeight,
      sizes: [size],
      activeSizeId: size.id,
      bgRemoved: Boolean(opts.bgRemoved),
    };
    commitDesign(design);
  }

  async function advanceQueue(rest) {
    const next = rest[0] || null;
    setPendingQueue(rest);
    setActivePending(next);
    if (next?.needsBgReview) {
      setDetectOpen(true);
      setCompareOpen(false);
      setCleanedPreview(null);
    } else if (next) {
      await finalizePending(next);
      await advanceQueue(rest.slice(1));
    } else {
      setDetectOpen(false);
      setCompareOpen(false);
      setCleanedPreview(null);
    }
  }

  /**
   * @param {FileList | File[]} fileList
   */
  async function processFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) =>
      String(f.type || '').startsWith('image/'),
    );
    if (!files.length) return;

    setAddOpen(false);
    setError(null);

    /** @type {typeof uploadRows} */
    const rows = files.map((f, i) => ({
      id: `up-${Date.now()}-${i}`,
      name: f.name,
      previewUrl: null,
      progress: 8,
      status: 'Reading file',
    }));
    setUploadRows(rows);
    setUploadOpen(true);

    /** @type {PendingUpload[]} */
    const pending = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const rowId = rows[i].id;

      const tick = (progress, status, previewUrl) => {
        setUploadRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  progress,
                  status,
                  previewUrl:
                    previewUrl !== undefined ? previewUrl : r.previewUrl,
                }
              : r,
          ),
        );
      };

      try {
        tick(18, 'Reading file');
        const dataUrl = await readFileAsDataUrl(file);
        tick(42, 'Loading image', dataUrl);
        await new Promise((r) => setTimeout(r, 180));
        const dims = await loadImageDims(dataUrl);
        tick(68, 'Checking background', dataUrl);
        const detect = await detectSolidBackground(dataUrl);
        tick(92, 'Finishing', dataUrl);
        await new Promise((r) => setTimeout(r, 120));

        pending.push({
          id: `des-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          label: file.name.replace(/\.[^.]+$/, '') || 'Design',
          fileName: file.name,
          originalDataUrl: dataUrl,
          imageDataUrl: dataUrl,
          naturalWidth: dims.w,
          naturalHeight: dims.h,
          bgHex: detect.hex,
          needsBgReview: detect.detected,
        });
        tick(100, 'Done', dataUrl);
      } catch (e) {
        console.error(e);
        tick(100, 'Failed');
        setError(
          e instanceof Error ? e.message : `Could not read ${file.name}`,
        );
      }
    }

    await new Promise((r) => setTimeout(r, 350));
    setUploadOpen(false);
    setUploadRows([]);

    if (!pending.length) return;

    // Auto-commit designs that do not need review; queue the rest
    /** @type {PendingUpload[]} */
    const needsReview = [];
    for (const p of pending) {
      if (p.needsBgReview) needsReview.push(p);
      else await finalizePending(p);
    }
    if (needsReview.length) {
      setPendingQueue(needsReview);
      setActivePending(needsReview[0]);
      setDetectOpen(true);
    }
  }

  function keepPendingAsIs() {
    if (!activePending) return;
    void (async () => {
      await finalizePending(activePending);
      await advanceQueue(pendingQueue.slice(1));
    })();
  }

  async function startRemoveBackground() {
    if (!activePending) return;
    setBgBusy(true);
    setError(null);
    try {
      const cleaned = await removeEdgeBackground(activePending.originalDataUrl, {
        tolerance: 42,
      });
      setCleanedPreview(cleaned);
      setDetectOpen(false);
      setCompareOpen(true);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Background removal failed');
    } finally {
      setBgBusy(false);
    }
  }

  function applyCleanedBackground() {
    if (!activePending || !cleanedPreview) return;
    void (async () => {
      await finalizePending(activePending, {
        cleanedUrl: cleanedPreview,
        bgRemoved: true,
      });
      setCompareOpen(false);
      setCleanedPreview(null);
      await advanceQueue(pendingQueue.slice(1));
    })();
  }

  function cancelBgFlow() {
    void (async () => {
      if (activePending) {
        await finalizePending(activePending);
      }
      setDetectOpen(false);
      setCompareOpen(false);
      setCleanedPreview(null);
      await advanceQueue(pendingQueue.slice(1));
    })();
  }

  /**
   * @param {GalleryDesign} design
   */
  function addDesignToCanvas(design) {
    const sizeRow = getActiveSize(design);
    const size = computePrintSize(design, sizeRow);
    const copies = Math.max(1, sizeRow.qty || 1);
    /** @type {PlacedItem[]} */
    const nextItems = [];
    let existing = [...placed];

    for (let i = 0; i < copies; i++) {
      const pos = findNextPlacement({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        widthIn: size.widthIn,
        heightIn: size.heightIn,
        existing,
      });
      const item = {
        id: `place-${design.id}-${sizeRow.id}-${Date.now()}-${i}`,
        designId: design.id,
        sizeId: sizeRow.id,
        label:
          copies > 1
            ? `${design.label} · ${sizeRow.longerSideIn}" (${i + 1})`
            : `${design.label} · ${sizeRow.longerSideIn}"`,
        imageDataUrl: design.imageDataUrl,
        widthIn: size.widthIn,
        heightIn: size.heightIn,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        flipH: false,
        flipV: false,
      };
      nextItems.push(item);
      existing = [...existing, item];
    }

    setPlaced((prev) => [...prev, ...nextItems]);
    setSelectedId(nextItems[0]?.id || null);
    setSavedRemoteId(null);
  }

  /**
   * Add Names & Numbers text graphics as separate movable sheet items.
   * @param {Array<{
   *   label: string;
   *   kind: 'name' | 'number';
   *   dataUrl: string;
   *   naturalWidth: number;
   *   naturalHeight: number;
   *   widthIn: number;
   *   heightIn: number;
   * }>} graphics
   */
  function addNamesNumbersGraphics(graphics) {
    /** @type {GalleryDesign[]} */
    const nextDesigns = [];
    /** @type {PlacedItem[]} */
    const nextItems = [];
    let existing = [...placed];
    const stamp = Date.now();

    graphics.forEach((g, i) => {
      const designId = `nn-${stamp}-${i}`;
      const longer = Math.max(g.widthIn, g.heightIn);
      const size = makeDesignSize(Number(longer.toFixed(2)), 1);
      /** @type {GalleryDesign} */
      const design = {
        id: designId,
        label: g.label,
        fileName: `${g.kind}-${g.label}.png`,
        imageDataUrl: g.dataUrl,
        originalDataUrl: g.dataUrl,
        naturalWidth: g.naturalWidth,
        naturalHeight: g.naturalHeight,
        sizes: [size],
        activeSizeId: size.id,
        bgRemoved: true,
      };
      nextDesigns.push(design);

      const pos = findNextPlacement({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        widthIn: g.widthIn,
        heightIn: g.heightIn,
        existing,
      });
      const item = {
        id: `place-${designId}`,
        designId,
        sizeId: size.id,
        label: g.label,
        imageDataUrl: g.dataUrl,
        widthIn: g.widthIn,
        heightIn: g.heightIn,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        flipH: false,
        flipV: false,
      };
      nextItems.push(item);
      existing = [...existing, item];
    });

    setDesigns((prev) => [...prev, ...nextDesigns]);
    setPlaced((prev) => [...prev, ...nextItems]);
    setSelectedId(nextItems[0]?.id || null);
    setSavedRemoteId(null);
  }

  /** Animate existing art into a denser pack on the sheet. */
  function tidyCanvas() {
    void tidyCanvasAsync();
  }

  /**
   * Pack pieces without overlap. Resolves with the next placed list
   * (after the tidy animation), so callers can save/preview that layout.
   * @param {{
   *   items?: PlacedItem[],
   *   sheetWidthIn?: number,
   *   sheetHeightIn?: number,
   * }} [opts] Optional overrides (e.g. right after a canvas size change).
   * @returns {Promise<PlacedItem[]>}
   */
  function tidyCanvasAsync(opts = {}) {
    return new Promise((resolve) => {
      const source = opts.items ?? placed;
      const sheetWidthIn = opts.sheetWidthIn ?? sheet.widthIn;
      const sheetHeightIn = opts.sheetHeightIn ?? sheet.heightIn;

      if (!source.length) {
        resolve(source);
        return;
      }
      if (tidying) {
        // Wait out an in-flight tidy, then resolve current placed.
        window.setTimeout(() => resolve(placed), 700);
        return;
      }

      setTidying(true);
      setSelectedId(null);

      const placements = packGangSheetItems({
        sheetWidthIn,
        sheetHeightIn,
        items: source.map((p) => ({
          id: p.id,
          widthIn: p.widthIn,
          heightIn: p.heightIn,
        })),
        canvasMarginIn: 0,
        imageMarginIn: 0.25,
        tidy: true,
      });

      const next = source.map((p) => {
        const pos = placements.get(p.id);
        if (!pos) return p;
        return {...p, x: pos.x, y: pos.y, rotation: 0};
      });

      // Double-rAF so CSS transitions catch the position change.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPlaced(next);
          setSavedRemoteId(null);
          window.setTimeout(() => {
            setTidying(false);
            resolve(next);
          }, 650);
        });
      });
    });
  }

  /**
   * If pieces overlap, tidy first so the saved/printed sheet is clean.
   * @param {PlacedItem[]} items
   * @returns {Promise<PlacedItem[]>}
   */
  async function ensurePrintReadyLayout(items) {
    if (
      !gangSheetHasOverlaps(items, sheet.widthIn, sheet.heightIn, 0.05)
    ) {
      return items;
    }
    return tidyCanvasAsync();
  }

  /**
   * Replace sheet contents with an Auto Build pack.
   * @param {{
   *   items: Array<{
   *     designId: string;
   *     label: string;
   *     imageDataUrl: string;
   *     widthIn: number;
   *     heightIn: number;
   *     x: number;
   *     y: number;
   *   }>;
   * }} payload
   */
  function applyAutoBuildLayout(payload) {
    const stamp = Date.now();
    /** @type {Record<string, number>} */
    const seen = {};
    /** @type {Record<string, number>} */
    const totals = {};
    for (const item of payload.items) {
      totals[item.designId] = (totals[item.designId] || 0) + 1;
    }
    /** @type {PlacedItem[]} */
    const nextItems = payload.items.map((item, i) => {
      seen[item.designId] = (seen[item.designId] || 0) + 1;
      const n = seen[item.designId];
      const total = totals[item.designId] || 1;
      return {
        id: `place-ab-${stamp}-${i}`,
        designId: item.designId,
        label: total > 1 ? `${item.label} (${n})` : item.label,
        imageDataUrl: item.imageDataUrl,
        widthIn: item.widthIn,
        heightIn: item.heightIn,
        x: item.x,
        y: item.y,
        rotation: 0,
        flipH: false,
        flipV: false,
      };
    });
    setPlaced(nextItems);
    setSelectedId(nextItems[0]?.id || null);
    setSavedRemoteId(null);
  }

  /**
   * @param {string} id
   * @param {Partial<PlacedItem>} partial
   */
  function updatePlaced(id, partial) {
    setPlaced((prev) =>
      prev.map((p) => (p.id === id ? {...p, ...partial} : p)),
    );
    setSavedRemoteId(null);
  }

  /**
   * Switch sheet size while keeping art in the same absolute inch position,
   * then tidy so pieces reflow cleanly on the new canvas.
   * @param {string} nextId
   */
  function changeSheetSize(nextId) {
    const nextSheet =
      DTF_GANG_SHEET_SIZES.find((s) => s.id === nextId) ||
      DTF_GANG_SHEET_SIZES[0];
    if (nextSheet.id === sheet.id) {
      setCanvasSizeOpen(false);
      return;
    }
    const prevW = sheet.widthIn;
    const prevH = sheet.heightIn;
    const remapped = placed.map((p) => {
      const centerXIn = p.x * prevW;
      const centerYIn = p.y * prevH;
      let widthIn = Math.min(p.widthIn, nextSheet.widthIn);
      let heightIn = Math.min(p.heightIn, nextSheet.heightIn);
      const aspect = p.widthIn / Math.max(p.heightIn, 0.01);
      if (widthIn / aspect > nextSheet.heightIn) {
        heightIn = nextSheet.heightIn;
        widthIn = heightIn * aspect;
      }
      if (heightIn * aspect > nextSheet.widthIn) {
        widthIn = nextSheet.widthIn;
        heightIn = widthIn / aspect;
      }
      widthIn = clamp(widthIn, MIN_IN, nextSheet.widthIn);
      heightIn = clamp(heightIn, MIN_IN, nextSheet.heightIn);
      const hw = widthIn / nextSheet.widthIn / 2;
      const hh = heightIn / nextSheet.heightIn / 2;
      return {
        ...p,
        widthIn: Number(widthIn.toFixed(3)),
        heightIn: Number(heightIn.toFixed(3)),
        x: clamp(centerXIn / nextSheet.widthIn, hw, 1 - hw),
        y: clamp(centerYIn / nextSheet.heightIn, hh, 1 - hh),
      };
    });
    setPlaced(remapped);
    setSheetId(nextSheet.id);
    setSavedRemoteId(null);
    setCanvasSizeOpen(false);
    userZoomedRef.current = false;

    // Keep URL in sync so refresh/share matches the canvas, and drop a stale
    // ?variant= from the size the user originally clicked into.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('size', nextSheet.id);
    nextParams.delete('variant');
    setSearchParams(nextParams, {replace: true});

    // Refresh auto design name when it still mirrors the previous size label.
    setDesignName((prev) => {
      const trimmed = String(prev || '').trim();
      if (!trimmed) return `Gang Sheet ${nextSheet.feetLabel}`;
      const prevLabel = sheet.feetLabel;
      if (
        trimmed === `Gang Sheet ${prevLabel}` ||
        trimmed === prevLabel
      ) {
        return `Gang Sheet ${nextSheet.feetLabel}`;
      }
      return prev;
    });

    if (remapped.length) {
      void tidyCanvasAsync({
        items: remapped,
        sheetWidthIn: nextSheet.widthIn,
        sheetHeightIn: nextSheet.heightIn,
      });
    }
  }

  /**
   * Keep a placed item fully inside the sheet (normalized center + inches).
   * @param {number} widthIn
   * @param {number} heightIn
   * @param {number} xNorm
   * @param {number} yNorm
   */
  function clampItemOnSheet(widthIn, heightIn, xNorm, yNorm) {
    let w = clamp(widthIn, MIN_IN, sheet.widthIn);
    let h = clamp(heightIn, MIN_IN, sheet.heightIn);
    const aspect = w / Math.max(h, 0.01);
    if (w > sheet.widthIn) {
      w = sheet.widthIn;
      h = w / aspect;
    }
    if (h > sheet.heightIn) {
      h = sheet.heightIn;
      w = h * aspect;
    }
    w = clamp(w, MIN_IN, sheet.widthIn);
    h = clamp(h, MIN_IN, sheet.heightIn);
    const hw = w / sheet.widthIn / 2;
    const hh = h / sheet.heightIn / 2;
    return {
      widthIn: Number(w.toFixed(3)),
      heightIn: Number(h.toFixed(3)),
      x: clamp(xNorm, hw, 1 - hw),
      y: clamp(yNorm, hh, 1 - hh),
    };
  }

  /**
   * Live-resize from a corner: opposite corner stays fixed, grows toward the drag,
   * and stays fully on the artboard.
   * @param {{ clientX: number; clientY: number }} e
   */
  function applyResizeFromPointer(e) {
    const r = resizeRef.current;
    const sheetEl = sheetElRef.current;
    if (!r || !sheetEl) return;
    const rect = sheetEl.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const pointerX =
      ((e.clientX - rect.left) / rect.width) * sheet.widthIn;
    const pointerY =
      ((e.clientY - rect.top) / rect.height) * sheet.heightIn;

    const rawW = (pointerX - r.fixedX) * r.signX;
    const rawH = (pointerY - r.fixedY) * r.signY;
    const aspect = Math.max(r.aspect, 0.01);

    // Max size available from the fixed corner toward the sheet edge
    const maxW =
      r.signX > 0 ? sheet.widthIn - r.fixedX : r.fixedX;
    const maxH =
      r.signY > 0 ? sheet.heightIn - r.fixedY : r.fixedY;
    const maxWidth = Math.max(
      MIN_IN,
      Math.min(maxW, maxH * aspect, sheet.widthIn),
    );
    const maxHeight = Math.max(
      MIN_IN,
      Math.min(maxH, maxW / aspect, sheet.heightIn),
    );

    let widthIn;
    let heightIn;
    if (rawW / aspect >= rawH) {
      widthIn = clamp(rawW, MIN_IN, maxWidth);
      heightIn = widthIn / aspect;
      if (heightIn > maxHeight) {
        heightIn = maxHeight;
        widthIn = heightIn * aspect;
      }
    } else {
      heightIn = clamp(rawH, MIN_IN, maxHeight);
      widthIn = heightIn * aspect;
      if (widthIn > maxWidth) {
        widthIn = maxWidth;
        heightIn = widthIn / aspect;
      }
    }

    const centerXIn = r.fixedX + r.signX * (widthIn / 2);
    const centerYIn = r.fixedY + r.signY * (heightIn / 2);
    const next = clampItemOnSheet(
      widthIn,
      heightIn,
      centerXIn / sheet.widthIn,
      centerYIn / sheet.heightIn,
    );

    updatePlaced(r.id, {
      widthIn: next.widthIn,
      heightIn: next.heightIn,
      x: next.x,
      y: next.y,
    });
    updateActiveSize(r.designId, {
      longerSideIn: Number(
        Math.max(next.widthIn, next.heightIn).toFixed(2),
      ),
    });
  }

  /**
   * @param {string} id
   * @param {string} designId
   * @param {PlacedItem} item
   * @param {import('react').PointerEvent} e
   * @param {'nw' | 'ne' | 'sw' | 'se'} corner
   */
  function beginResize(id, designId, item, e, corner) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    dragRef.current = null;

    const signX = corner === 'ne' || corner === 'se' ? 1 : -1;
    const signY = corner === 'sw' || corner === 'se' ? 1 : -1;
    const cxIn = item.x * sheet.widthIn;
    const cyIn = item.y * sheet.heightIn;
    const hw = item.widthIn / 2;
    const hh = item.heightIn / 2;
    // Opposite corner stays anchored while this corner is dragged.
    const fixedX = cxIn - signX * hw;
    const fixedY = cyIn - signY * hh;

    resizeRef.current = {
      id,
      designId,
      aspect: item.widthIn / Math.max(item.heightIn, 0.01),
      corner,
      fixedX,
      fixedY,
      signX,
      signY,
    };
    sheetClickClearsRef.current = false;
    sheetElRef.current?.setPointerCapture?.(e.pointerId);
  }

  function duplicatePlaced() {
    if (!selected) return;
    const copy = {
      ...selected,
      id: `place-${Date.now()}-dup`,
      x: clamp(selected.x + 0.03, 0.02, 0.98),
      y: clamp(selected.y + 0.03, 0.02, 0.98),
      label: `${selected.label} copy`,
    };
    setPlaced((prev) => [...prev, copy]);
    setSelectedId(copy.id);
    setSavedRemoteId(null);
  }

  function removePlaced() {
    if (!selectedId) return;
    setPlaced((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
    setSavedRemoteId(null);
  }

  /**
   * Remove every copy of a design from the sheet (right-rail trash).
   * @param {string} designId
   */
  function removeSheetGroup(designId) {
    setPlaced((prev) => prev.filter((p) => p.designId !== designId));
    if (selected?.designId === designId) setSelectedId(null);
    setSavedRemoteId(null);
  }

  /** Clear all art from the canvas; gallery uploads stay. */
  function clearCanvas() {
    setPlaced([]);
    setSelectedId(null);
    setSavedRemoteId(null);
    setClearCanvasOpen(false);
  }

  /**
   * Set how many copies of a design appear on the sheet.
   * @param {string} designId
   * @param {number} nextQty
   */
  function setSheetGroupQty(designId, nextQty) {
    const qty = Math.max(0, Math.floor(Number(nextQty) || 0));
    const items = placed.filter((p) => p.designId === designId);
    if (!items.length) return;

    if (qty <= 0) {
      removeSheetGroup(designId);
      return;
    }
    if (qty === items.length) return;

    if (qty < items.length) {
      const removeCount = items.length - qty;
      const ordered = [...items].sort((a, b) => {
        if (a.id === selectedId) return 1;
        if (b.id === selectedId) return -1;
        return 0;
      });
      const drop = new Set(ordered.slice(0, removeCount).map((i) => i.id));
      setPlaced((prev) => prev.filter((p) => !drop.has(p.id)));
      if (selectedId && drop.has(selectedId)) {
        const keep = ordered.find((i) => !drop.has(i.id));
        setSelectedId(keep?.id || null);
      }
      setSavedRemoteId(null);
      return;
    }

    const sample = items[0];
    const design = designs.find((d) => d.id === designId);
    const baseLabel = (design?.label || sample.label || 'Art').replace(
      /\s*\(\d+\)\s*$/,
      '',
    );
    const addCount = qty - items.length;
    /** @type {PlacedItem[]} */
    const nextItems = [];
    let existing = [...placed];
    const stamp = Date.now();

    for (let i = 0; i < addCount; i++) {
      const pos = findNextPlacement({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        widthIn: sample.widthIn,
        heightIn: sample.heightIn,
        existing,
      });
      const item = {
        id: `place-${designId}-qty-${stamp}-${i}`,
        designId,
        sizeId: sample.sizeId,
        label: `${baseLabel} (${items.length + i + 1})`,
        imageDataUrl: sample.imageDataUrl,
        widthIn: sample.widthIn,
        heightIn: sample.heightIn,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        flipH: false,
        flipV: false,
      };
      nextItems.push(item);
      existing = [...existing, item];
    }

    setPlaced((prev) => [...prev, ...nextItems]);
    setSavedRemoteId(null);
  }

  function removeDesign(id) {
    setDesigns((prev) => prev.filter((d) => d.id !== id));
    setPlaced((prev) => prev.filter((p) => p.designId !== id));
    if (selected?.designId === id) setSelectedId(null);
    setSavedRemoteId(null);
  }

  /**
   * @param {string} designId
   * @param {Partial<DesignSize>} partial
   */
  function updateActiveSize(designId, partial) {
    setDesigns((prev) =>
      prev.map((d) => {
        if (d.id !== designId) return d;
        const active = getActiveSize(d);
        return {
          ...d,
          sizes: designSizes(d).map((s) =>
            s.id === active.id ? {...s, ...partial} : s,
          ),
        };
      }),
    );
  }

  async function reRemoveBackground(design) {
    setBgBusy(true);
    setError(null);
    try {
      const cleaned = await removeEdgeBackground(
        design.originalDataUrl || design.imageDataUrl,
        {tolerance: 42},
      );
      const dims = await loadImageDims(cleaned);
      setDesigns((prev) =>
        prev.map((d) =>
          d.id === design.id
            ? {
                ...d,
                imageDataUrl: cleaned,
                naturalWidth: dims.w,
                naturalHeight: dims.h,
                bgRemoved: true,
              }
            : d,
        ),
      );
      setPlaced((prev) =>
        prev.map((p) =>
          p.designId === design.id ? {...p, imageDataUrl: cleaned} : p,
        ),
      );
      setSavedRemoteId(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Background removal failed');
    } finally {
      setBgBusy(false);
    }
  }

  /**
   * @param {GalleryDesign} design
   * @param {PlacedItem} item
   */
  async function upscaleDesign(design, item) {
    setUpscaleBusy(true);
    setError(null);
    try {
      let src = design.imageDataUrl;
      if (src && !String(src).startsWith('data:')) {
        src = (await fetchImageAsDataUrl(src)) || '';
      }
      if (!src?.startsWith('data:')) {
        setError(
          'Could not prepare this image for upscaling. Try re-uploading it.',
        );
        return;
      }
      const result = await upscaleImageToPrintDpi(
        src,
        item.widthIn,
        item.heightIn,
        300,
      );
      if (result.scale <= 1.02) {
        setError('Image is already sharp enough at this print size.');
        return;
      }
      setDesigns((prev) =>
        prev.map((d) =>
          d.id === design.id
            ? {
                ...d,
                imageDataUrl: result.dataUrl,
                naturalWidth: result.width,
                naturalHeight: result.height,
              }
            : d,
        ),
      );
      setPlaced((prev) =>
        prev.map((p) =>
          p.designId === design.id
            ? {...p, imageDataUrl: result.dataUrl}
            : p,
        ),
      );
      setSavedRemoteId(null);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Upscale failed';
      setError(
        /tainted/i.test(msg)
          ? 'Could not process this image (cross-origin). Try Edit again or re-upload the artwork.'
          : msg,
      );
    } finally {
      setUpscaleBusy(false);
    }
  }

  /** @param {GalleryDesign} design */
  function restoreOriginal(design) {
    void loadImageDims(design.originalDataUrl).then((dims) => {
      const longer = recommendedPrintLongerSide(
        {naturalWidth: dims.w, naturalHeight: dims.h},
        sheetMaxIn,
      );
      const active = getActiveSize(design);
      setDesigns((prev) =>
        prev.map((d) =>
          d.id === design.id
            ? {
                ...d,
                imageDataUrl: d.originalDataUrl,
                naturalWidth: dims.w,
                naturalHeight: dims.h,
                bgRemoved: false,
                sizes: designSizes(d).map((s) =>
                  s.id === active.id ? {...s, longerSideIn: longer} : s,
                ),
              }
            : d,
        ),
      );
      setPlaced((prev) =>
        prev.map((p) => {
          if (p.designId !== design.id) return p;
          const next = computePrintSize(
            {naturalWidth: dims.w, naturalHeight: dims.h},
            {id: active.id, longerSideIn: longer, qty: active.qty},
          );
          return {
            ...p,
            imageDataUrl: design.originalDataUrl,
            widthIn: next.widthIn,
            heightIn: next.heightIn,
          };
        }),
      );
      setSavedRemoteId(null);
    });
  }

  async function handleSave() {
    setError(null);
    if (!placed.length) {
      setError('Add at least one design to the sheet.');
      return;
    }
    if (!variant?.id) {
      setError(
        `Missing Shopify variant for ${sheet.variantTitle}. Create the product first.`,
      );
      return;
    }

    setBusy(true);
    try {
      const itemsForPreview = placed.map((p) => ({
        id: p.id,
        label: p.label,
        imageDataUrl: p.imageDataUrl,
        transform: {
          x: p.x,
          y: p.y,
          scale: p.widthIn / sheet.widthIn,
          rotation: p.rotation,
          flipH: Boolean(p.flipH),
          flipV: Boolean(p.flipV),
        },
        widthIn: p.widthIn,
        heightIn: p.heightIn,
      }));

      const previewDataUrl = await composeGangSheetPreview({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        items: itemsForPreview,
        transparent: true,
        framing: 'top-square',
      });

      const remote = await saveGangSheetRemote({
        sheetSize: sheet.id,
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        productHandle: product?.handle || DTF_GANG_SHEET_PRODUCT_HANDLE,
        productId: product?.id || null,
        designName: designName.trim() || null,
        previewBase64: previewDataUrl,
        items: placed.map((p) => ({
          id: p.id,
          designId: p.designId,
          label: p.label,
          transform: {
            x: p.x,
            y: p.y,
            scale: p.widthIn / sheet.widthIn,
            rotation: p.rotation,
          },
          imageBase64: p.imageDataUrl,
          widthIn: p.widthIn,
          heightIn: p.heightIn,
        })),
      });

      if (!remote?.id) {
        setError('Could not save gang sheet. Check the design API and try again.');
        return;
      }
      setSavedRemoteId(String(remote.id));
      setPreviewUrl(remote.previewUrl || previewDataUrl);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  /**
   * @param {PlacedItem[]} [source]
   */
  async function buildItemsForPreview(source = placed) {
    /** @type {import('~/lib/dtfGangSheetApi').GangSheetItemLocal[]} */
    const items = [];
    for (const p of source) {
      let imageDataUrl = p.imageDataUrl;
      if (imageDataUrl && !String(imageDataUrl).startsWith('data:')) {
        imageDataUrl = await fetchImageAsDataUrl(imageDataUrl);
      }
      if (!imageDataUrl?.startsWith('data:')) {
        console.warn('[dtf] skipping item without data URL', p.id);
        continue;
      }
      items.push({
        id: p.id,
        label: p.label,
        imageDataUrl,
        transform: {
          x: p.x,
          y: p.y,
          scale: p.widthIn / sheet.widthIn,
          rotation: p.rotation,
          flipH: Boolean(p.flipH),
          flipV: Boolean(p.flipV),
        },
        widthIn: p.widthIn,
        heightIn: p.heightIn,
      });
    }
    return items;
  }

  async function openConfirmOrder() {
    setError(null);
    if (!placed.length) {
      setError('Add at least one design to the sheet.');
      return;
    }
    if (!variant?.id) {
      setError(
        `Missing Shopify variant for ${sheet.variantTitle}. Create the product first.`,
      );
      return;
    }
    setBusy(true);
    try {
      const layout = await ensurePrintReadyLayout(placed);
      const previewDataUrl = await composeGangSheetPreview({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        items: await buildItemsForPreview(layout),
        transparent: true,
        maxPx: 480,
        framing: 'top-square',
      });
      setConfirmPreview(previewDataUrl);
      if (!designName.trim()) {
        setDesignName(`Gang Sheet ${sheet.feetLabel}`);
      }
      setConfirmOpen(true);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? /tainted/i.test(e.message)
            ? 'Could not prepare order preview. Try Edit again from the cart.'
            : e.message
          : 'Could not prepare order',
      );
    } finally {
      setBusy(false);
    }
  }

  async function runAddToCartFlow() {
    if (addToCartInFlightRef.current) return;
    const name = designName.trim();
    if (!name || !variant?.id || !placed.length) return;

    addToCartInFlightRef.current = true;
    setConfirmOpen(false);
    setUpdateMode(false);
    setAddingOpen(true);
    cartRedirectScheduledRef.current = false;
    setAddProgress({completedSteps: 0, percent: 8, error: null});

    try {
      // Step 1 — tidy overlaps, then prepare design preview
      setAddProgress({completedSteps: 0, percent: 18, error: null});
      const layout = await ensurePrintReadyLayout(placed);
      const previewItems = await buildItemsForPreview(layout);
      const previewDataUrl = await composeGangSheetPreview({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        items: previewItems,
        transparent: true,
        framing: 'top-square',
      });
      setConfirmPreview(previewDataUrl);
      setAddProgress({completedSteps: 1, percent: 38, error: null});

      // Step 2 — upload art + packet to GCloud
      const remote = await saveGangSheetRemote({
        sheetSize: sheet.id,
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        productHandle: product?.handle || DTF_GANG_SHEET_PRODUCT_HANDLE,
        productId: product?.id || null,
        designName: name,
        previewBase64: previewDataUrl,
        items: layout.map((p) => ({
          id: p.id,
          designId: p.designId,
          label: p.label,
          transform: {
            x: p.x,
            y: p.y,
            scale: p.widthIn / sheet.widthIn,
            rotation: p.rotation,
            flipH: Boolean(p.flipH),
            flipV: Boolean(p.flipV),
          },
          imageBase64:
            previewItems.find((i) => i.id === p.id)?.imageDataUrl ||
            p.imageDataUrl,
          widthIn: p.widthIn,
          heightIn: p.heightIn,
        })),
      });

      if (!remote?.id) {
        throw new Error(
          'Could not save gang sheet. Check the design API and try again.',
        );
      }

      const remoteId = String(remote.id);
      const hostedPreview = remote.previewUrl || previewDataUrl;
      setSavedRemoteId(remoteId);
      setPreviewUrl(hostedPreview);
      setAddProgress({completedSteps: 2, percent: 72, error: null});

      // Step 3 — add Shopify cart line with packet attributes
      const attributes = buildGangSheetLineAttributes(
        {
          remoteId,
          sheetSize: sheet.id,
          sheetWidthIn: sheet.widthIn,
          sheetHeightIn: sheet.heightIn,
          items: layout.map((p) => ({
            id: p.id,
            label: p.label,
            transform: {
              x: p.x,
              y: p.y,
              scale: p.widthIn / sheet.widthIn,
              rotation: p.rotation,
              flipH: Boolean(p.flipH),
              flipV: Boolean(p.flipV),
            },
            imageDataUrl: p.imageDataUrl,
            widthIn: p.widthIn,
            heightIn: p.heightIn,
          })),
          previewUrl: hostedPreview,
          productHandle: product?.handle || DTF_GANG_SHEET_PRODUCT_HANDLE,
          designName: name,
        },
        {
          packetBaseUrl: getDesignApiBaseUrl(),
          designName: name,
        },
      );

      const formData = new FormData();
      formData.set(
        CartForm.INPUT_NAME,
        JSON.stringify({
          action: CartForm.ACTIONS.LinesAdd,
          inputs: {
            lines: [
              {
                merchandiseId: variant.id,
                quantity: orderQty,
                attributes,
              },
            ],
          },
        }),
      );

      cartSubmitSeenRef.current = false;
      cartFetcher.submit(formData, {method: 'post', action: '/cart'});
    } catch (e) {
      console.error(e);
      setAddProgress({
        completedSteps: 0,
        percent: 0,
        error: e instanceof Error ? e.message : 'Add to cart failed',
      });
      addToCartInFlightRef.current = false;
    }
  }

  async function runUpdateSheetFlow() {
    if (addToCartInFlightRef.current || !canUpdateCartLine) return;
    const name = designName.trim();
    if (!name || !variant?.id || !placed.length || !editCartLineId) return;
    if (!sheetDirty) return;

    addToCartInFlightRef.current = true;
    setUpdateMode(true);
    setAddingOpen(true);
    cartRedirectScheduledRef.current = false;
    setAddProgress({completedSteps: 0, percent: 8, error: null});

    try {
      setAddProgress({completedSteps: 0, percent: 18, error: null});
      const layout = await ensurePrintReadyLayout(placed);
      const previewItems = await buildItemsForPreview(layout);
      const previewDataUrl = await composeGangSheetPreview({
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        items: previewItems,
        transparent: true,
        framing: 'top-square',
      });
      setAddProgress({completedSteps: 1, percent: 38, error: null});

      const remote = await saveGangSheetRemote({
        gangSheetId: editGangSheetId || savedRemoteId,
        sheetSize: sheet.id,
        sheetWidthIn: sheet.widthIn,
        sheetHeightIn: sheet.heightIn,
        productHandle: product?.handle || DTF_GANG_SHEET_PRODUCT_HANDLE,
        productId: product?.id || null,
        designName: name,
        previewBase64: previewDataUrl,
        items: layout.map((p) => ({
          id: p.id,
          designId: p.designId,
          label: p.label,
          transform: {
            x: p.x,
            y: p.y,
            scale: p.widthIn / sheet.widthIn,
            rotation: p.rotation,
            flipH: Boolean(p.flipH),
            flipV: Boolean(p.flipV),
          },
          imageBase64:
            previewItems.find((i) => i.id === p.id)?.imageDataUrl ||
            p.imageDataUrl,
          widthIn: p.widthIn,
          heightIn: p.heightIn,
        })),
      });

      if (!remote?.id) {
        throw new Error(
          'Could not update gang sheet. Check the design API and try again.',
        );
      }

      const remoteId = String(remote.id);
      const hostedPreview = remote.previewUrl || previewDataUrl;
      setSavedRemoteId(remoteId);
      setPreviewUrl(hostedPreview);
      setAddProgress({completedSteps: 2, percent: 72, error: null});

      const attributes = buildGangSheetLineAttributes(
        {
          remoteId,
          sheetSize: sheet.id,
          sheetWidthIn: sheet.widthIn,
          sheetHeightIn: sheet.heightIn,
          items: layout.map((p) => ({
            id: p.id,
            label: p.label,
            transform: {
              x: p.x,
              y: p.y,
              scale: p.widthIn / sheet.widthIn,
              rotation: p.rotation,
              flipH: Boolean(p.flipH),
              flipV: Boolean(p.flipV),
            },
            imageDataUrl: p.imageDataUrl,
            widthIn: p.widthIn,
            heightIn: p.heightIn,
          })),
          previewUrl: hostedPreview,
          productHandle: product?.handle || DTF_GANG_SHEET_PRODUCT_HANDLE,
          designName: name,
        },
        {
          packetBaseUrl: getDesignApiBaseUrl(),
          designName: name,
        },
      );

      const formData = new FormData();
      formData.set(
        CartForm.INPUT_NAME,
        JSON.stringify({
          action: CartForm.ACTIONS.LinesUpdate,
          inputs: {
            lines: [
              {
                id: editCartLineId,
                merchandiseId: variant.id,
                attributes,
              },
            ],
          },
        }),
      );

      cartSubmitSeenRef.current = false;
      cartFetcher.submit(formData, {method: 'post', action: '/cart'});
    } catch (e) {
      console.error(e);
      setAddProgress({
        completedSteps: 0,
        percent: 0,
        error: e instanceof Error ? e.message : 'Update failed',
      });
      addToCartInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!addingOpen || !addToCartInFlightRef.current) return;
    if (addProgress.error) return;
    if (addProgress.completedSteps < 2) return;
    if (cartRedirectScheduledRef.current) return;

    if (cartFetcher.state === 'submitting' || cartFetcher.state === 'loading') {
      cartSubmitSeenRef.current = true;
      setAddProgress((prev) =>
        prev.percent >= 88
          ? prev
          : {...prev, percent: Math.max(prev.percent, 88)},
      );
      return;
    }

    if (cartFetcher.state !== 'idle' || !cartSubmitSeenRef.current) return;

    const cartErrors = cartFetcher.data?.errors;
    if (Array.isArray(cartErrors) && cartErrors.length) {
      const msg =
        cartErrors
          .map((e) => (typeof e === 'string' ? e : e?.message || String(e)))
          .filter(Boolean)
          .join(' ') || 'Cart update failed';
      setAddProgress({completedSteps: 2, percent: 72, error: msg});
      addToCartInFlightRef.current = false;
      return;
    }

    if (!cartFetcher.data?.cart) {
      setAddProgress({
        completedSteps: 2,
        percent: 72,
        error: 'Cart update failed. Please try again.',
      });
      addToCartInFlightRef.current = false;
      return;
    }

    // Mark success once — do not clear the redirect timer on later effect runs.
    cartRedirectScheduledRef.current = true;
    addToCartInFlightRef.current = false;
    setAddProgress({completedSteps: 3, percent: 100, error: null});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cartUpdated'));
    }
    if (isEditMode) {
      editBaselineRef.current = sheetFingerprint(placed, sheetId, designName);
      setSheetDirty(false);
    }
    window.setTimeout(() => {
      navigate('/cart');
    }, 1600);
  }, [
    addingOpen,
    addProgress.completedSteps,
    addProgress.error,
    cartFetcher.state,
    cartFetcher.data,
    navigate,
    isEditMode,
    placed,
    sheetId,
    designName,
  ]);

  const rulerTicksX = useMemo(
    () => buildRulerTicks(sheet.widthIn),
    [sheet.widthIn],
  );
  const rulerTicksY = useMemo(
    () => buildRulerTicks(sheet.heightIn),
    [sheet.heightIn],
  );

  const scrollRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const userZoomedRef = useRef(false);
  const panRef = useRef(
    /** @type {{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null} */ (
      null
    ),
  );
  const zoomAnchorRef = useRef(
    /** @type {{ x: number; y: number } | null} */ (null),
  );
  const minZoomRef = useRef(BUILD_ZOOM_MIN);
  const pendingFitRef = useRef(
    /** @type {null | { mode: 'contain' | 'width' | 'height'; smooth: boolean }} */ (
      null
    ),
  );
  const sheetFrameRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const pxPerIn = BUILD_PX_PER_IN * zoom;
  const sheetW = sheet.widthIn * pxPerIn;
  const sheetH = sheet.heightIn * pxPerIn;
  const rulerPad = 28;

  /** Smallest zoom that still fits the whole sheet in the viewport. */
  useEffect(() => {
    if (!leaveConfirmOpen) return undefined;
    /**
     * @param {KeyboardEvent} e
     */
    function onKey(e) {
      if (e.key === 'Escape') setLeaveConfirmOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveConfirmOpen]);

  const getMinZoom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return minZoomRef.current || BUILD_ZOOM_MIN;
    const pad = 64;
    const baseW = sheet.widthIn * BUILD_PX_PER_IN + rulerPad;
    const baseH = sheet.heightIn * BUILD_PX_PER_IN + rulerPad;
    const availW = Math.max(el.clientWidth - pad, 80);
    const availH = Math.max(el.clientHeight - pad, 80);
    const contain = Math.min(availW / baseW, availH / baseH);
    const minZ = clamp(
      Number(contain.toFixed(3)),
      BUILD_ZOOM_MIN,
      BUILD_ZOOM_MAX,
    );
    minZoomRef.current = minZ;
    return minZ;
  }, [sheet.heightIn, sheet.widthIn]);

  /** @param {number} value */
  function clampZoom(value) {
    return clamp(Number(value.toFixed(3)), getMinZoom(), BUILD_ZOOM_MAX);
  }

  /**
   * After zoom/layout, pin scroll so fit-width keeps the artboard top visible.
   * @param {'contain' | 'width' | 'height'} mode
   * @param {boolean} [smooth]
   */
  function alignFitScroll(mode, smooth = false) {
    const sc = scrollRef.current;
    if (!sc) return;
    const maxLeft = Math.max(0, sc.scrollWidth - sc.clientWidth);
    const maxTop = Math.max(0, sc.scrollHeight - sc.clientHeight);
    const behavior = smooth ? 'smooth' : 'auto';

    if (mode === 'width') {
      // Fit width: scale to panel width, then pin the TOP of the board in view.
      sc.scrollLeft = maxLeft / 2;
      sc.scrollTop = 0;
      return;
    }

    if (mode === 'height') {
      sc.scrollTo({left: 0, top: maxTop / 2, behavior});
      return;
    }

    sc.scrollTo({left: maxLeft / 2, top: maxTop / 2, behavior});
  }

  /**
   * @param {'contain' | 'width' | 'height'} mode
   * @param {{ smooth?: boolean }} [opts]
   */
  const fitZoomToView = useCallback(
    (mode = 'contain', opts = {}) => {
      const el = scrollRef.current;
      if (!el) return;
      const pad = 72;
      const baseW = sheet.widthIn * BUILD_PX_PER_IN + rulerPad;
      const baseH = sheet.heightIn * BUILD_PX_PER_IN + rulerPad;
      const availW = Math.max(el.clientWidth - pad, 80);
      const availH = Math.max(el.clientHeight - pad, 80);
      const contain = Math.min(availW / baseW, availH / baseH);
      const minZ = clamp(
        Number(contain.toFixed(3)),
        BUILD_ZOOM_MIN,
        BUILD_ZOOM_MAX,
      );
      minZoomRef.current = minZ;

      let next;
      if (mode === 'width') {
        next = availW / baseW;
      } else if (mode === 'height') {
        next = availH / baseH;
      } else {
        next = contain;
      }
      const clamped = clamp(Number(next.toFixed(3)), minZ, BUILD_ZOOM_MAX);
      zoomAnchorRef.current = null;
      pendingFitRef.current = {
        mode,
        smooth: Boolean(opts.smooth) && mode !== 'width',
      };
      setZoom(clamped);

      // Always align after commit — even when zoom value did not change (no effect run).
      void Promise.resolve().then(() => {
        requestAnimationFrame(() => {
          const pending = pendingFitRef.current;
          if (!pending) return;
          pendingFitRef.current = null;
          alignFitScroll(pending.mode, pending.smooth);
          requestAnimationFrame(() => alignFitScroll(pending.mode, false));
        });
      });
    },
    [sheet.heightIn, sheet.widthIn],
  );

  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;

    const pending = pendingFitRef.current;
    if (pending) {
      pendingFitRef.current = null;
      alignFitScroll(pending.mode, pending.smooth);
      return;
    }

    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    const maxLeft = Math.max(0, sc.scrollWidth - sc.clientWidth);
    const maxTop = Math.max(0, sc.scrollHeight - sc.clientHeight);
    sc.scrollLeft = clamp(
      anchor.x * sc.scrollWidth - sc.clientWidth / 2,
      0,
      maxLeft,
    );
    sc.scrollTop = clamp(
      anchor.y * sc.scrollHeight - sc.clientHeight / 2,
      0,
      maxTop,
    );
  }, [zoom, sheetW, sheetH]);

  useLayoutEffect(() => {
    userZoomedRef.current = false;
    fitZoomToView('contain', {smooth: true});
  }, [fitZoomToView]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      getMinZoom();
      if (!userZoomedRef.current) {
        fitZoomToView('contain');
        return;
      }
      setZoom((z) => Math.max(z, minZoomRef.current));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitZoomToView, getMinZoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    /**
     * @param {WheelEvent} e
     */
    function onWheel(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const sc = scrollRef.current;
      if (sc) {
        zoomAnchorRef.current = {
          x: (sc.scrollLeft + sc.clientWidth / 2) / Math.max(sc.scrollWidth, 1),
          y: (sc.scrollTop + sc.clientHeight / 2) / Math.max(sc.scrollHeight, 1),
        };
      }
      userZoomedRef.current = true;
      const minZ = getMinZoom();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) =>
        clamp(Number((z + delta).toFixed(3)), minZ, BUILD_ZOOM_MAX),
      );
    }
    el.addEventListener('wheel', onWheel, {passive: false});
    return () => el.removeEventListener('wheel', onWheel);
  }, [getMinZoom]);

  /** @param {number | ((z: number) => number)} next */
  function bumpZoom(next) {
    userZoomedRef.current = true;
    const sc = scrollRef.current;
    if (sc) {
      zoomAnchorRef.current = {
        x: (sc.scrollLeft + sc.clientWidth / 2) / Math.max(sc.scrollWidth, 1),
        y: (sc.scrollTop + sc.clientHeight / 2) / Math.max(sc.scrollHeight, 1),
      };
    }
    setZoom((z) => {
      const raw = typeof next === 'function' ? next(z) : next;
      return clampZoom(raw);
    });
  }

  /**
   * @param {'contain' | 'width' | 'height'} mode
   */
  function applyFit(mode) {
    userZoomedRef.current = mode !== 'contain';
    zoomAnchorRef.current = null;
    fitZoomToView(mode, {smooth: mode !== 'width'});
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  const leaveDestination = isEditMode
    ? '/cart'
    : '/dtf-sheets';
  const leaveDestinationLabel = isEditMode ? 'cart' : 'DTF Sheets home';

  function confirmLeaveStudio() {
    setLeaveConfirmOpen(false);
    navigate(leaveDestination);
  }

  return (
    <div className="dtf-studio dtf-studio--unified">
      {loadingEdit ? (
        <div className="dtf-studio-loading" role="status">
          <Loader2 className="dtf-modal-spin" size={22} strokeWidth={2.5} />
          <span>Loading your gang sheet…</span>
        </div>
      ) : null}
      <header className="dtf-studio-bar">
        <div className="dtf-studio-bar-start">
          <button
            type="button"
            className="dtf-studio-close"
            aria-label={isEditMode ? 'Back to cart' : 'Back to DTF Sheets'}
            onClick={() => setLeaveConfirmOpen(true)}
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <div>
            <p className="dtf-studio-kicker">
              {isEditMode ? 'Edit Gang Sheet' : 'Gang Sheet Builder'}
            </p>
            <h1 className="dtf-studio-title">
              {sheet.feetLabel} · 22″ · {priceLabel}
            </h1>
          </div>
        </div>

        <div className="dtf-studio-bar-end">
          <div className="dtf-studio-bar-actions">
            {!isEditMode ? (
              <button
                type="button"
                className="dtf-bar-save"
                disabled={busy || addingOpen || !placed.length}
                onClick={() => void handleSave()}
              >
                {busy ? 'Saving…' : 'Save Gang Sheet'}
              </button>
            ) : null}
            {isEditMode ? (
              <button
                type="button"
                className="dtf-bar-update"
                disabled={
                  busy ||
                  loadingEdit ||
                  addingOpen ||
                  !placed.length ||
                  !variant?.id ||
                  !sheetDirty ||
                  !canUpdateCartLine
                }
                title={
                  !canUpdateCartLine
                    ? 'Open this sheet from your cart to update it'
                    : !sheetDirty
                      ? 'Make a change to update the sheet'
                      : !placed.length
                        ? 'Add designs to the sheet first'
                        : undefined
                }
                onClick={() => void runUpdateSheetFlow()}
              >
                <Save size={15} strokeWidth={2.25} aria-hidden />
                {addingOpen && updateMode ? 'Updating…' : 'Update Sheet'}
              </button>
            ) : (
              <button
                type="button"
                className="dtf-bar-atc"
                disabled={
                  busy ||
                  addingOpen ||
                  confirmOpen ||
                  !placed.length ||
                  !variant?.id
                }
                title={
                  !placed.length
                    ? 'Add designs to the sheet first'
                    : !variant?.id
                      ? 'Missing Shopify variant'
                      : undefined
                }
                onClick={() => void openConfirmOrder()}
              >
                {`Add to Cart${orderQty > 1 ? ` ×${orderQty}` : ''}`}
              </button>
            )}
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="dtf-studio-file-input"
        onChange={(e) => {
          void processFiles(e.target.files || []);
          e.target.value = '';
        }}
      />

      {error ? (
        <p className="dtf-studio-banner-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div
        className={`dtf-unified${selected ? ' has-drawer' : ''}`}
        onPointerDownCapture={(e) => {
          if (!selectedId) return;
          const el = e.target;
          if (!(el instanceof Element)) return;
          // Keep selection when interacting with art, its handles, or the options drawer.
          if (el.closest('.dtf-studio-item')) return;
          if (el.closest('.dtf-image-drawer')) return;
          if (el.closest('.dtf-canvas-zoom-dock')) return;
          // Right-rail sheet list selects/retargets art — don't clear first.
          if (el.closest('.dtf-studio-art-list button')) return;
          if (el.closest('.dtf-sheet-group')) return;
          sheetClickClearsRef.current = false;
          setSelectedId(null);
        }}
      >
        {/* LEFT — gallery (always visible) */}
        <div className="dtf-unified-left">
          <div className="dtf-unified-left-top">
            <button
              type="button"
              className="dtf-gallery-nn"
              onClick={() => setNamesOpen(true)}
            >
              <Type size={17} strokeWidth={2.25} />
              Names &amp; Numbers
            </button>
            <button
              type="button"
              className="dtf-gallery-add"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={18} strokeWidth={2.5} />
              Add Images
            </button>
          </div>

          <div className="dtf-gallery-section">
            <div className="dtf-gallery-section-head">
              <p>
                Gallery
                <span>
                  · {designs.length} image{designs.length === 1 ? '' : 's'}
                </span>
              </p>
              {designs.length ? (
                <button
                  type="button"
                  className="dtf-gallery-clear"
                  onClick={() => {
                    setDesigns([]);
                    setPlaced([]);
                    setSelectedId(null);
                    setSavedRemoteId(null);
                  }}
                >
                  <Trash2 size={13} />
                  Clear
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="dtf-gallery-drop"
              onClick={() => setAddOpen(true)}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('is-dragover');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('is-dragover');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('is-dragover');
                if (e.dataTransfer.files?.length) {
                  void processFiles(e.dataTransfer.files);
                }
              }}
            >
              <Upload size={20} strokeWidth={1.75} />
              <span>Drop images here or click to add</span>
            </button>

            {designs.length ? (
              <ul className="dtf-gallery-grid">
                {designs.map((d) => {
                  const size = computePrintSize(d, getActiveSize(d));
                  return (
                    <li key={d.id} className="dtf-gallery-card">
                      <div className="dtf-gallery-thumb">
                        <img src={d.imageDataUrl} alt="" />
                        <button
                          type="button"
                          className="dtf-gallery-add-canvas"
                          title="Add to Canvas"
                          aria-label={`Add ${d.label} to canvas`}
                          onClick={() => addDesignToCanvas(d)}
                        >
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          className="dtf-gallery-card-trash"
                          aria-label={`Remove ${d.label}`}
                          onClick={() => removeDesign(d.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="dtf-gallery-name" title={d.fileName}>
                        {d.label}
                      </p>
                      <p className="dtf-gallery-dims">
                        {size.widthIn.toFixed(1)}″ × {size.heightIn.toFixed(1)}″
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="dtf-smart-layout">
            <p className="dtf-studio-section-label">Smart Layout</p>
            <button
              type="button"
              className="dtf-smart-btn dtf-smart-btn--primary"
              onClick={() => setAutoBuildOpen(true)}
              title="Set quantities and auto-pack your gang sheet"
            >
              <span className="dtf-smart-btn-main">
                <Wand2 size={16} strokeWidth={2.25} />
                Auto Build
              </span>
              <Info
                size={14}
                strokeWidth={2.25}
                aria-hidden
                title="Choose quantities per image and apply an optimized layout"
              />
            </button>
            <button
              type="button"
              className="dtf-smart-btn dtf-smart-btn--secondary"
              onClick={tidyCanvas}
              disabled={!placed.length || tidying}
              title="Re-pack art on the sheet for denser coverage"
            >
              <span className="dtf-smart-btn-main">
                <LayoutGrid size={16} strokeWidth={2.25} />
                {tidying ? 'Tidying…' : 'Tidy Canvas'}
              </span>
              <Info
                size={14}
                strokeWidth={2.25}
                aria-hidden
                title="Animate pieces into a clean, space-saving pack"
              />
            </button>
          </div>
        </div>

        {/* CENTER — canvas */}
        <div className="dtf-unified-center">
          <div className="dtf-canvas-toolbar">
            <div className="dtf-canvas-toolbar-size" ref={canvasSizeRef}>
              <span
                className="dtf-canvas-toolbar-label"
                id={`${inputId}-canvas-size`}
              >
                Size
              </span>
              <button
                type="button"
                className={`dtf-canvas-toolbar-select${canvasSizeOpen ? ' is-open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={canvasSizeOpen}
                aria-labelledby={`${inputId}-canvas-size`}
                onClick={() => setCanvasSizeOpen((o) => !o)}
              >
                <strong>{sheet.feetLabel.replace(/ Feet?/i, ' ft')}</strong>
                <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
              </button>
              {canvasSizeOpen ? (
                <ul
                  className="dtf-canvas-toolbar-menu"
                  role="listbox"
                  aria-label="Sheet size"
                >
                  {DTF_GANG_SHEET_SIZES.map((s) => {
                    const isSel = s.id === sheetId;
                    return (
                      <li key={s.id} role="option" aria-selected={isSel}>
                        <button
                          type="button"
                          className={isSel ? 'is-selected' : ''}
                          onClick={() => {
                            changeSheetSize(s.id);
                            setCanvasSizeOpen(false);
                          }}
                        >
                          <strong>{s.feetLabel}</strong>
                          <em>
                            {s.widthIn}″ × {s.heightIn}″
                          </em>
                          {isSel ? (
                            <Check size={14} strokeWidth={2.5} aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <span className="dtf-canvas-toolbar-divider" aria-hidden />

            <button
              type="button"
              className="dtf-canvas-toolbar-icon"
              title="Clear canvas"
              aria-label="Clear canvas"
              disabled={!placed.length}
              onClick={() => setClearCanvasOpen(true)}
            >
              <BrushCleaning size={17} strokeWidth={2.1} />
            </button>
          </div>

          <div
            className="dtf-build-canvas-scroll"
            ref={scrollRef}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.button !== 1) return;
              const t = e.target;
              if (!(t instanceof Element)) return;
              // Pan empty viewport chrome; middle-mouse pans anywhere in the graph.
              const onArt = t.closest(
                '.dtf-studio-item, .dtf-build-sheet, .dtf-canvas-zoom-dock, .dtf-item-handle, .dtf-item-float-tools, .dtf-canvas-toolbar',
              );
              if (onArt && e.button === 0) return;
              const sc = scrollRef.current;
              if (!sc) return;
              panRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                scrollLeft: sc.scrollLeft,
                scrollTop: sc.scrollTop,
              };
              sc.classList.add('is-panning');
              sc.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              const pan = panRef.current;
              const sc = scrollRef.current;
              if (!pan || !sc) return;
              sc.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX);
              sc.scrollTop = pan.scrollTop - (e.clientY - pan.startY);
            }}
            onPointerUp={(e) => {
              panRef.current = null;
              scrollRef.current?.classList.remove('is-panning');
              try {
                scrollRef.current?.releasePointerCapture?.(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            onPointerCancel={() => {
              panRef.current = null;
              scrollRef.current?.classList.remove('is-panning');
            }}
          >
            <div className="dtf-build-canvas-stage">
              <div
                className="dtf-build-canvas-scale"
                style={{
                  width: sheetW + 22,
                  height: sheetH + 22,
                }}
              >
              <div
                className="dtf-build-sheet-frame"
                ref={sheetFrameRef}
                style={{width: sheetW, height: sheetH}}
              >
                <div className="dtf-ruler dtf-ruler--x" aria-hidden>
                  {rulerTicksX.map((inch) => (
                    <span
                      key={`x-${inch}`}
                      className={`dtf-ruler-tick${inch % 1 === 0 ? ' is-major' : ''}`}
                      style={{left: `${(inch / sheet.widthIn) * 100}%`}}
                    >
                      {inch % 1 === 0 ? (
                        <em>{inch === 0 ? '0' : inch}</em>
                      ) : null}
                    </span>
                  ))}
                  <span className="dtf-ruler-unit">in</span>
                </div>
                <div className="dtf-ruler dtf-ruler--y" aria-hidden>
                  {rulerTicksY.map((inch) => (
                    <span
                      key={`y-${inch}`}
                      className={`dtf-ruler-tick${inch % 1 === 0 ? ' is-major' : ''}`}
                      style={{top: `${(inch / sheet.heightIn) * 100}%`}}
                    >
                      {inch % 1 === 0 ? (
                        <em>{inch === 0 ? '0' : inch}</em>
                      ) : null}
                    </span>
                  ))}
                </div>

                <div
                  className={`dtf-build-sheet${tidying ? ' is-tidying' : ''}`}
                  ref={sheetElRef}
                  onPointerDown={(e) => {
                    // Capture-retargeted clicks from art would look like sheet clicks;
                    // only allow deselect when the gesture started on empty board.
                    sheetClickClearsRef.current = e.target === e.currentTarget;
                  }}
                  onPointerMove={(e) => {
                    if (resizeRef.current) {
                      applyResizeFromPointer(e);
                      return;
                    }
                    const d = dragRef.current;
                    if (!d) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const dx = (e.clientX - d.startX) / rect.width;
                    const dy = (e.clientY - d.startY) / rect.height;
                    const next = clampItemOnSheet(
                      d.widthIn,
                      d.heightIn,
                      d.ox + dx,
                      d.oy + dy,
                    );
                    updatePlaced(d.id, {x: next.x, y: next.y});
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                    resizeRef.current = null;
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null;
                    resizeRef.current = null;
                  }}
                  onClick={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      sheetClickClearsRef.current
                    ) {
                      setSelectedId(null);
                    }
                    sheetClickClearsRef.current = false;
                  }}
                >
                  {placed.map((p) => {
                    const d = designs.find((x) => x.id === p.designId);
                    const dpi = estimateDpi(
                      {
                        naturalWidth: d?.naturalWidth || 1,
                        naturalHeight: d?.naturalHeight || 1,
                      },
                      {widthIn: p.widthIn, heightIn: p.heightIn},
                    );
                    const flipX = p.flipH ? -1 : 1;
                    const flipY = p.flipV ? -1 : 1;
                    return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      className={`dtf-studio-item${selectedId === p.id ? ' is-selected' : ''}`}
                      style={{
                        left: `${p.x * 100}%`,
                        top: `${p.y * 100}%`,
                        width: `${(p.widthIn / sheet.widthIn) * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${p.rotation || 0}deg) scale(${flipX}, ${flipY})`,
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        sheetClickClearsRef.current = false;
                        setSelectedId(p.id);
                        resizeRef.current = null;
                        dragRef.current = {
                          id: p.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          ox: p.x,
                          oy: p.y,
                          widthIn: p.widthIn,
                          heightIn: p.heightIn,
                        };
                        sheetElRef.current?.setPointerCapture?.(e.pointerId);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(p.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(p.id);
                        }
                      }}
                    >
                      <img src={p.imageDataUrl} alt={p.label} draggable={false} />
                      {selectedId === p.id ? (
                        <>
                          <span className="dtf-item-float-tools">
                            <button
                              type="button"
                              title="Duplicate"
                              aria-label="Duplicate"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicatePlaced();
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              title="Remove"
                              aria-label="Remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                removePlaced();
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <Trash2 size={13} />
                            </button>
                          </span>
                          {['nw', 'ne', 'sw', 'se'].map((corner) => (
                            <span
                              key={corner}
                              className={`dtf-item-handle dtf-item-handle--${corner}`}
                              role="presentation"
                              aria-hidden="true"
                              onPointerDown={(e) =>
                                beginResize(
                                  p.id,
                                  p.designId,
                                  p,
                                  e,
                                  /** @type {'nw' | 'ne' | 'sw' | 'se'} */ (
                                    corner
                                  ),
                                )
                              }
                            />
                          ))}
                          <span
                            className={`dtf-item-size-tag${dpi < 100 ? ' is-warn' : dpi >= 300 ? ' is-good' : ''}`}
                          >
                            w {p.widthIn.toFixed(1)}″ × h {p.heightIn.toFixed(1)}″
                            {' · '}
                            {dpi >= 300 ? '300+ DPI' : `${dpi} DPI`}
                          </span>
                        </>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          </div>

          {(() => {
            const needsUpscale = placed
              .map((p) => {
                const d = designs.find((x) => x.id === p.designId);
                const dpi = estimateDpi(
                  {
                    naturalWidth: d?.naturalWidth || 1,
                    naturalHeight: d?.naturalHeight || 1,
                  },
                  {widthIn: p.widthIn, heightIn: p.heightIn},
                );
                return {p, d, dpi};
              })
              .filter((x) => x.dpi < 300 && x.d)
              .sort((a, b) => a.dpi - b.dpi);
            if (!needsUpscale.length) return null;
            const first = needsUpscale[0];
            const critical = needsUpscale.filter((x) => x.dpi < 100);
            const count = needsUpscale.length;
            return (
              <div
                className={`dtf-dpi-alert${critical.length ? ' is-critical' : ''}`}
                role="status"
              >
                <div className="dtf-dpi-alert-copy">
                  <strong>
                    {critical.length
                      ? `Boost Image Quality · ${critical.length} image${critical.length === 1 ? '' : 's'} under 100 DPI`
                      : `Upscale recommended · ${count} image${count === 1 ? '' : 's'} under 300 DPI`}
                  </strong>
                  <span title={first.d?.fileName}>
                    {first.d?.label} · {first.dpi} DPI
                  </span>
                </div>
                <button
                  type="button"
                  className="dtf-dpi-alert-btn"
                  disabled={upscaleBusy || !first.d}
                  onClick={() => {
                    if (first.d) void upscaleDesign(first.d, first.p);
                  }}
                >
                  <Wand2 size={14} />
                  {upscaleBusy ? 'Upscaling…' : 'Upscale Image'}
                </button>
                <p className="dtf-dpi-alert-hint">
                  {critical.length
                    ? 'Images need to be 100 DPI or higher to print well. Upscale to continue.'
                    : 'For crisp DTF prints we recommend 300 DPI. Upscale this artwork or shrink it on the sheet.'}
                </p>
              </div>
            );
          })()}

          <div className="dtf-canvas-zoom-dock" role="group" aria-label="Canvas zoom">
            <div className="dtf-canvas-zoom-group">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                onClick={() => bumpZoom((z) => z - 0.1)}
              >
                <ZoomOut size={16} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="dtf-canvas-zoom-pct"
                title="Fit sheet in view"
                onClick={() => applyFit('contain')}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                onClick={() => bumpZoom((z) => z + 0.1)}
              >
                <ZoomIn size={16} strokeWidth={2.25} />
              </button>
            </div>
            <button
              type="button"
              className="dtf-canvas-zoom-fit"
              aria-label="Fit width"
              title="Fit width — fill panel width, keep top of sheet visible"
              onClick={() => applyFit('width')}
            >
              <ArrowLeftRight size={16} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="dtf-canvas-zoom-fit"
              aria-label="Fit height"
              title="Fit height — fill panel height"
              onClick={() => applyFit('height')}
            >
              <Maximize2 size={16} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {/* RIGHT — sheet summary */}
        <div className="dtf-unified-right">
          <div className="dtf-unified-right-scroll">
            <p className="dtf-studio-section-label">On sheet</p>
            {!sheetGroups.length ? (
              <p className="dtf-unified-right-empty">
                Nothing on the sheet yet. Add an image from the gallery.
              </p>
            ) : (
              <ul className="dtf-sheet-groups">
                {sheetGroups.map((g) => (
                  <li key={g.designId}>
                    <div
                      className={`dtf-sheet-group${g.isActive ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(g.sample.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(g.sample.id);
                        }
                      }}
                    >
                      <img src={g.imageDataUrl} alt="" />
                      <div className="dtf-sheet-group-meta">
                        <strong title={g.label}>{g.label}</strong>
                        <small>
                          {g.widthIn.toFixed(1)}″ × {g.heightIn.toFixed(1)}″
                          {'  '}
                          {g.dpi >= 300 ? '300+ DPI' : `${g.dpi} DPI`}
                        </small>
                      </div>
                      <label
                        className="dtf-sheet-group-qty"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min={1}
                          value={g.qty}
                          aria-label={`${g.label} quantity`}
                          onChange={(e) =>
                            setSheetGroupQty(
                              g.designId,
                              Number(e.target.value) || 1,
                            )
                          }
                        />
                        <span aria-hidden>×</span>
                      </label>
                      <button
                        type="button"
                        className="dtf-sheet-group-del"
                        title="Remove from sheet"
                        aria-label={`Remove ${g.label} from sheet`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSheetGroup(g.designId);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dtf-unified-right-foot">
            <div className="dtf-coverage">
              <div className="dtf-coverage-stat">
                <span>Images</span>
                <strong>{placed.length}</strong>
              </div>
              <div className="dtf-coverage-stat">
                <span>Gang Sheet ({sheet.feetLabel})</span>
                <strong>{priceLabel}</strong>
              </div>
              <div className="dtf-coverage-bar-row">
                <span>Image Coverage</span>
                <em>{coveragePct}%</em>
              </div>
              <div className="dtf-coverage-bar">
                <span style={{width: `${coveragePct}%`}} />
              </div>
            </div>
          </div>
        </div>

        {drawerPayload ? (
          <ImageOptionsPanel
            open={drawerOpen}
            design={
              selected && selectedDesign
                ? selectedDesign
                : drawerPayload.design
            }
            placed={selected || drawerPayload.placed}
            sheet={sheet}
            sheetMaxIn={sheetMaxIn}
            bgBusy={bgBusy}
            upscaleBusy={upscaleBusy}
            onClose={() => setSelectedId(null)}
            onExited={() => setDrawerPayload(null)}
            onUpdatePlaced={updatePlaced}
            onUpdateSize={(partial) => {
              const designId =
                (selected && selectedDesign
                  ? selectedDesign
                  : drawerPayload.design
                ).id;
              updateActiveSize(designId, partial);
            }}
            onDuplicate={duplicatePlaced}
            onRemove={removePlaced}
            onRemoveBg={() => {
              const design =
                selected && selectedDesign
                  ? selectedDesign
                  : drawerPayload.design;
              void reRemoveBackground(design);
            }}
            onUpscale={() => {
              const design =
                selected && selectedDesign
                  ? selectedDesign
                  : drawerPayload.design;
              const item = selected || drawerPayload.placed;
              void upscaleDesign(design, item);
            }}
            onReset={() => {
              const design =
                selected && selectedDesign
                  ? selectedDesign
                  : drawerPayload.design;
              restoreOriginal(design);
            }}
          />
        ) : null}
      </div>

      <AddImagesModal
        open={addOpen}
        elevated={autoBuildOpen}
        onClose={() => setAddOpen(false)}
        onBrowse={() => {
          setAddOpen(false);
          openPicker();
        }}
        onDropFiles={(files) => void processFiles(files)}
      />
      <NamesNumbersModal
        open={namesOpen}
        sheetFeetLabel={sheet.feetLabel}
        onClose={() => setNamesOpen(false)}
        onAddGraphics={addNamesNumbersGraphics}
      />
      <AutoBuildModal
        open={autoBuildOpen}
        designs={designs}
        placed={placed}
        sheet={sheet}
        onClose={() => {
          if (addOpen || uploadOpen || detectOpen || compareOpen) return;
          setAutoBuildOpen(false);
        }}
        onAddImages={() => setAddOpen(true)}
        onApply={applyAutoBuildLayout}
      />
      <ConfirmOrderModal
        open={confirmOpen}
        designName={designName}
        sheetSizeLabel={sheet.feetLabel.replace(/ Feet$/i, ' ft').replace(/ Foot$/i, ' ft')}
        imageCount={placed.length}
        images={sheetGroups.map((g) => ({
          id: g.designId,
          label: g.label,
          imageDataUrl: g.imageDataUrl,
          widthIn: g.widthIn,
          heightIn: g.heightIn,
          qty: g.qty,
        }))}
        priceLabel={priceLabel}
        previewUrl={confirmPreview}
        busy={addingOpen}
        onDesignNameChange={setDesignName}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void runAddToCartFlow()}
      />
      <AddingToCartModal
        open={addingOpen}
        completedSteps={addProgress.completedSteps}
        percent={addProgress.percent}
        designName={designName}
        sheetSizeLabel={sheet.feetLabel
          .replace(/ Feet$/i, ' ft')
          .replace(/ Foot$/i, ' ft')}
        mode={updateMode ? 'update' : 'add'}
        error={addProgress.error}
        onClose={() => {
          if (!addProgress.error && addProgress.completedSteps < 3) return;
          setAddingOpen(false);
          setUpdateMode(false);
          addToCartInFlightRef.current = false;
          if (addProgress.completedSteps >= 3 && !addProgress.error) {
            navigate('/cart');
          }
        }}
      />
      <UploadProgressModal
        open={uploadOpen}
        elevated={autoBuildOpen}
        files={uploadRows}
        onClose={() => setUploadOpen(false)}
      />
      <BackgroundDetectModal
        open={detectOpen && Boolean(activePending)}
        elevated={autoBuildOpen}
        fileName={activePending?.fileName || ''}
        previewUrl={activePending?.imageDataUrl || ''}
        bgHex={activePending?.bgHex || '#FFFFFF'}
        onKeep={keepPendingAsIs}
        onRemove={() => void startRemoveBackground()}
        onClose={cancelBgFlow}
      />
      <RemoveBgCompareModal
        open={compareOpen && Boolean(activePending)}
        elevated={autoBuildOpen}
        fileName={activePending?.fileName || ''}
        originalUrl={activePending?.originalDataUrl || ''}
        cleanedUrl={cleanedPreview || ''}
        busy={bgBusy}
        onCancel={cancelBgFlow}
        onApply={applyCleanedBackground}
      />

      {clearCanvasOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="dtf-modal-root"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dtf-clear-canvas-title"
              onClick={() => setClearCanvasOpen(false)}
            >
              <div
                className="dtf-modal dtf-modal--clear"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="dtf-modal-header">
                  <h2 id="dtf-clear-canvas-title">Clear Canvas?</h2>
                  <button
                    type="button"
                    className="dtf-modal-close"
                    aria-label="Close"
                    onClick={() => setClearCanvasOpen(false)}
                  >
                    <X size={18} strokeWidth={2.25} />
                  </button>
                </header>
                <div className="dtf-modal-body">
                  <p className="dtf-clear-copy">
                    This will remove all images from the canvas. Your uploaded
                    images will remain in the gallery.
                  </p>
                </div>
                <footer className="dtf-modal-footer">
                  <button
                    type="button"
                    className="dtf-modal-secondary"
                    onClick={() => setClearCanvasOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="dtf-modal-danger"
                    onClick={clearCanvas}
                  >
                    Clear Canvas
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      {leaveConfirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="dtf-modal-root dtf-modal-root--elevated"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dtf-leave-studio-title"
              onClick={() => setLeaveConfirmOpen(false)}
            >
              <div
                className="dtf-modal dtf-modal--leave"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="dtf-modal-header dtf-leave-header">
                  <div className="dtf-modal-header-lead">
                    <span className="dtf-leave-icon" aria-hidden>
                      <ArrowLeft size={18} strokeWidth={2.25} />
                    </span>
                    <div>
                      <h2 id="dtf-leave-studio-title">
                        {isEditMode ? 'Leave editor?' : 'Leave builder?'}
                      </h2>
                      <p className="dtf-modal-sub">
                        You’ll return to the {leaveDestinationLabel}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dtf-modal-close"
                    aria-label="Close"
                    onClick={() => setLeaveConfirmOpen(false)}
                  >
                    <X size={18} strokeWidth={2.25} />
                  </button>
                </header>
                <div className="dtf-modal-body">
                  <p className="dtf-leave-copy">
                    {isEditMode
                      ? 'Unsaved changes on this gang sheet won’t be updated in your cart.'
                      : 'Your current layout won’t be saved to the cart until you add it.'}
                  </p>
                </div>
                <footer className="dtf-modal-footer">
                  <button
                    type="button"
                    className="dtf-modal-secondary"
                    onClick={() => setLeaveConfirmOpen(false)}
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    className="dtf-modal-primary"
                    onClick={confirmLeaveStudio}
                  >
                    {isEditMode ? 'Back to cart' : 'Back to home'}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * Slide-out image adjustor (left drawer) when a canvas item is selected.
 * Canvas stays interactive — no blocking scrim.
 * @param {{
 *   open: boolean;
 *   design: GalleryDesign;
 *   placed: PlacedItem;
 *   sheet: import('~/lib/dtfSheetConstants').DtfSheetSize;
 *   sheetMaxIn: number;
 *   bgBusy: boolean;
 *   upscaleBusy: boolean;
 *   onClose: () => void;
 *   onExited: () => void;
 *   onUpdatePlaced: (id: string, partial: Partial<PlacedItem>) => void;
 *   onUpdateSize: (partial: Partial<DesignSize>) => void;
 *   onDuplicate: () => void;
 *   onRemove: () => void;
 *   onRemoveBg: () => void;
 *   onUpscale: () => void;
 *   onReset: () => void;
 * }} props
 */
function ImageOptionsPanel({
  open,
  design,
  placed,
  sheet,
  sheetMaxIn,
  bgBusy,
  upscaleBusy,
  onClose,
  onExited,
  onUpdatePlaced,
  onUpdateSize,
  onDuplicate,
  onRemove,
  onRemoveBg,
  onUpscale,
  onReset,
}) {
  const [locked, setLocked] = useState(true);
  const drawerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const active = getActiveSize(design);
  const dpi = estimateDpi(design, {
    widthIn: placed.widthIn,
    heightIn: placed.heightIn,
  });
  const dpiFix = suggestedLongerSideForDpi(design, 300, sheetMaxIn);
  const aspect = placed.widthIn / Math.max(placed.heightIn, 0.01);
  const presetId =
    SIZE_PRESETS.find((p) => Math.abs(active.longerSideIn - p.inches) < 0.05)
      ?.id || 'custom';

  useEffect(() => {
    const el = drawerRef.current;
    if (!el) return undefined;
    /**
     * @param {TransitionEvent} e
     */
    function onTransitionEnd(e) {
      if (e.target !== el || e.propertyName !== 'transform') return;
      if (!open) onExited();
    }
    el.addEventListener('transitionend', onTransitionEnd);
    return () => el.removeEventListener('transitionend', onTransitionEnd);
  }, [open, onExited]);

  /**
   * @param {number} widthIn
   * @param {number} heightIn
   */
  function applySize(widthIn, heightIn) {
    onUpdatePlaced(placed.id, {widthIn, heightIn});
    onUpdateSize({
      longerSideIn: Number(Math.max(widthIn, heightIn).toFixed(2)),
    });
  }

  return (
    <div
      ref={drawerRef}
      className={`dtf-image-drawer${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-hidden={!open}
      aria-labelledby="dtf-image-drawer-title"
    >
        <header className="dtf-image-drawer-head">
          <div className="dtf-image-drawer-head-text">
            <p className="dtf-image-drawer-kicker" id="dtf-image-drawer-title">
              Image Options
            </p>
            <h2 title={design.fileName}>{design.label}</h2>
          </div>
          <div className="dtf-image-drawer-head-actions">
            <button
              type="button"
              className="dtf-image-drawer-remove"
              onClick={onRemove}
            >
              <Trash2 size={14} />
              Remove
            </button>
            <button
              type="button"
              className="dtf-image-drawer-x"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="dtf-image-drawer-body">
          <div className="dtf-image-drawer-size-block">
            <div className="dtf-image-drawer-dims">
              <label>
                <span>Width</span>
                <div className="dtf-art-inch-input">
                  <input
                    type="number"
                    min={MIN_IN}
                    max={sheet.widthIn}
                    step={0.05}
                    value={Number(placed.widthIn.toFixed(2))}
                    onChange={(e) => {
                      const widthIn = clamp(
                        Number(e.target.value) || MIN_IN,
                        MIN_IN,
                        sheet.widthIn,
                      );
                      const heightIn = locked
                        ? clamp(widthIn / aspect, MIN_IN, sheet.heightIn)
                        : placed.heightIn;
                      applySize(widthIn, heightIn);
                    }}
                  />
                  <span>in</span>
                </div>
              </label>

              <button
                type="button"
                className={`dtf-aspect-lock${locked ? ' is-locked' : ''}`}
                aria-label={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                title={locked ? 'Aspect locked' : 'Aspect unlocked'}
                onClick={() => setLocked((v) => !v)}
              >
                {locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>

              <label>
                <span>Height</span>
                <div className="dtf-art-inch-input">
                  <input
                    type="number"
                    min={MIN_IN}
                    max={sheet.heightIn}
                    step={0.05}
                    value={Number(placed.heightIn.toFixed(2))}
                    onChange={(e) => {
                      const heightIn = clamp(
                        Number(e.target.value) || MIN_IN,
                        MIN_IN,
                        sheet.heightIn,
                      );
                      const widthIn = locked
                        ? clamp(heightIn * aspect, MIN_IN, sheet.widthIn)
                        : placed.widthIn;
                      applySize(widthIn, heightIn);
                    }}
                  />
                  <span>in</span>
                </div>
              </label>

              <div
                className={`dtf-dpi-badge${dpi >= 300 ? ' is-good' : dpi >= 100 ? ' is-ok' : ' is-low'}`}
                title={
                  dpiFix != null && dpi < 300
                    ? `For 300 DPI keep longer side ≤ ${dpiFix.toFixed(2)}″`
                    : undefined
                }
              >
                {dpi >= 300 ? (
                  <>
                    <Check size={13} strokeWidth={2.5} />
                    300+ DPI
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">⚠️</span>
                    {dpi} DPI
                  </>
                )}
              </div>
            </div>

            <div className="dtf-image-drawer-row">
              <label className="dtf-image-drawer-field">
                <span>Custom sizing</span>
                <select
                  value={presetId}
                  onChange={(e) => {
                    const preset = SIZE_PRESETS.find(
                      (p) => p.id === e.target.value,
                    );
                    if (!preset) return;
                    const longer = Math.min(preset.inches, sheetMaxIn);
                    const next = computePrintSize(design, {
                      ...active,
                      longerSideIn: longer,
                    });
                    applySize(next.widthIn, next.heightIn);
                  }}
                >
                  <option value="custom">Custom sizing</option>
                  {SIZE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} · {p.inches}″
                    </option>
                  ))}
                </select>
              </label>

              <label className="dtf-image-drawer-field">
                <span>Quantity</span>
                <div className="dtf-qty-stepper">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      onUpdateSize({qty: Math.max(1, (active.qty || 1) - 1)})
                    }
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={active.qty}
                    onChange={(e) =>
                      onUpdateSize({
                        qty: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => onUpdateSize({qty: (active.qty || 1) + 1})}
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
          </div>

          <section className="dtf-image-drawer-section">
            <p className="dtf-io-section-label">Actions</p>
            <div className="dtf-io-grid dtf-io-grid--2">
              <button
                type="button"
                className="dtf-io-tile dtf-io-tile--lg is-accent"
                disabled
                title="Coming soon"
              >
                <span className="dtf-io-tile-icons">
                  <Scissors size={17} />
                  <Check size={12} strokeWidth={3} className="dtf-io-tile-check" />
                </span>
                Auto Crop &amp; Trim
              </button>
              <button
                type="button"
                className="dtf-io-tile dtf-io-tile--lg"
                onClick={onDuplicate}
              >
                <Copy size={18} />
                Duplicate
              </button>
            </div>
          </section>

          <section className="dtf-image-drawer-section">
            <p className="dtf-io-section-label">Edit</p>
            <div className="dtf-io-grid dtf-io-grid--3">
              <button
                type="button"
                className="dtf-io-tile"
                disabled
                title="Coming soon"
              >
                <Crop size={16} />
                Crop
              </button>
              <button
                type="button"
                className={`dtf-io-tile${design.bgRemoved ? ' is-done' : ''}`}
                disabled={bgBusy || design.bgRemoved}
                onClick={onRemoveBg}
              >
                {design.bgRemoved ? (
                  <Check size={16} strokeWidth={2.5} />
                ) : (
                  <Layers size={16} />
                )}
                {bgBusy
                  ? 'Working…'
                  : design.bgRemoved
                    ? 'BG removed'
                    : 'Remove BG'}
              </button>
              <button
                type="button"
                className={`dtf-io-tile${dpi < 300 ? ' is-accent' : ''}`}
                disabled={upscaleBusy || dpi >= 300}
                onClick={onUpscale}
                title={
                  dpi >= 300
                    ? 'Already at 300+ DPI'
                    : 'Upscale pixels for sharper print'
                }
              >
                <Wand2 size={16} />
                {upscaleBusy ? 'Working…' : 'Upscale'}
              </button>
              <button
                type="button"
                className="dtf-io-tile"
                disabled
                title="Coming soon"
              >
                <Palette size={16} />
                Edit Colors
              </button>
              <button
                type="button"
                className="dtf-io-tile"
                disabled
                title="Coming soon"
              >
                <Sparkles size={16} />
                Knockout Colors
              </button>
              <button type="button" className="dtf-io-tile" onClick={onReset}>
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </section>

          <section className="dtf-image-drawer-section">
            <p className="dtf-io-section-label">Transform</p>
            <div className="dtf-io-grid dtf-io-grid--3">
              <button
                type="button"
                className="dtf-io-tile"
                onClick={() =>
                  onUpdatePlaced(placed.id, {
                    rotation: ((placed.rotation || 0) + 90) % 360,
                  })
                }
              >
                <RotateCw size={16} />
                Rotate
              </button>
              <button
                type="button"
                className={`dtf-io-tile${placed.flipH ? ' is-on' : ''}`}
                onClick={() =>
                  onUpdatePlaced(placed.id, {flipH: !placed.flipH})
                }
              >
                <FlipHorizontal size={16} />
                Flip H
              </button>
              <button
                type="button"
                className={`dtf-io-tile${placed.flipV ? ' is-on' : ''}`}
                onClick={() =>
                  onUpdatePlaced(placed.id, {flipV: !placed.flipV})
                }
              >
                <FlipVertical size={16} />
                Flip V
              </button>
            </div>
          </section>
        </div>

        <button
          type="button"
          className="dtf-image-drawer-collapse"
          aria-label="Collapse image options"
          onClick={onClose}
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
      </div>
  );
}
