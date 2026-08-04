import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Image as HydrogenImage} from '@shopify/hydrogen';
import {
  X,
  Upload,
  Eraser,
  RotateCcw,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pipette,
  Wand2,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  DEFAULT_DESIGN_TRANSFORM,
  fileToDataUrl,
  removeLogoBackground,
  removeColorsFromImage,
  sampleImageColor,
  saveDesignRemote,
  composeStageExactPreview,
} from '~/lib/designStudioApi';
import {
  PRINT_STYLES,
  detectGarmentKind,
  garmentViewForLocation,
  locationsForGarment,
  pickGarmentViewImage,
  LOCATION_CATALOG,
} from '~/components/DesignStudio/designStudioLocations';
import {ColorDropdown} from '~/components/ColorDropdown';

const STEPS = [
  {id: 'color', label: 'Color'},
  {id: 'locations', label: 'Locations'},
  {id: 'artwork', label: 'Artwork'},
  {id: 'print', label: 'Print'},
];

/**
 * Normalize color codes so `#000000` and `000000` compare equal.
 * @param {string | null | undefined} code
 */
function normalizeColorCode(code) {
  return String(code || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase();
}

/**
 * Prefer the studio swatch's canonical code when the PDP passes a tag-style code.
 * @param {string | null | undefined} code
 * @param {Array<{ code?: string }>} colors
 */
function resolveStudioColorCode(code, colors = []) {
  const want = normalizeColorCode(code);
  if (!want) return null;
  const match = colors.find((c) => normalizeColorCode(c.code) === want);
  return match?.code || (String(code || '').startsWith('#') ? String(code) : code ? `#${want}` : null);
}

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
function colorsMatch(a, b) {
  const na = normalizeColorCode(a);
  const nb = normalizeColorCode(b);
  return Boolean(na) && na === nb;
}

/**
 * Full-screen design studio for custom decorated apparel.
 *
 * Flow: color → decoration locations → artwork upload/place → print style → save.
 *
 * Note: do NOT use a raw <aside> here — global cart drawer CSS targets `aside`
 * and parks it off-screen (`right: -var(--aside-width)`).
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   onSave: (design: import('~/lib/designStudioApi').SavedProductDesign) => void;
 *   productTitle: string;
 *   productHandle: string;
 *   productId?: string | null;
 *   colorCode: string | null;
 *   colorName?: string | null;
 *   productImage: { url: string; altText?: string | null; width?: number; height?: number; id?: string } | null;
 *   productImages?: Array<{ url: string; altText?: string | null; width?: number; height?: number; id?: string }>;
 *   colors?: Array<{ code: string; name: string; image?: any; product?: any }>;
 *   onConfirmColor?: (colorCode: string) => void;
 *   initialDesign?: import('~/lib/designStudioApi').SavedProductDesign | null;
 * }}
 */
export function DesignStudioModal({
  open,
  onClose,
  onSave,
  productTitle,
  productHandle,
  productId = null,
  colorCode,
  colorName = null,
  productImage,
  productImages = [],
  colors = [],
  onConfirmColor,
  initialDesign = null,
}) {
  const garmentKind = useMemo(
    () => detectGarmentKind(productTitle),
    [productTitle],
  );
  const locationOptions = useMemo(
    () => locationsForGarment(garmentKind),
    [garmentKind],
  );

  const [step, setStep] = useState(
    /** @type {'color' | 'locations' | 'artwork' | 'print'} */ ('color'),
  );
  const [pendingColor, setPendingColor] = useState(() =>
    resolveStudioColorCode(colorCode, colors) || colorCode,
  );
  const wasOpenRef = useRef(false);

  /** @type {[string[], Function]} */
  const [selectedLocationIds, setSelectedLocationIds] = useState(() => {
    if (initialDesign?.locations?.length) {
      return initialDesign.locations.map((l) => l.id);
    }
    return [];
  });
  const [activeLocationId, setActiveLocationId] = useState(
    /** @type {string | null} */ (
      initialDesign?.locations?.[0]?.id || null
    ),
  );
  /** @type {[Record<string, { logoDataUrl: string; originalDataUrl: string; transform: typeof DEFAULT_DESIGN_TRANSFORM }>, Function]} */
  const [artByLocation, setArtByLocation] = useState(() =>
    hydrateArt(initialDesign),
  );
  const [printStyle, setPrintStyle] = useState(
    /** @type {'simple' | 'full'} */ (initialDesign?.printStyle || 'simple'),
  );
  const [rightsOk, setRightsOk] = useState(false);
  const [rightsNeedsAttention, setRightsNeedsAttention] = useState(false);
  const [locationsNeedAttention, setLocationsNeedAttention] = useState(false);
  const [busy, setBusy] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [dragging, setDragging] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  /** @type {[Array<{ r: number; g: number; b: number; hex: string }>, Function]} */
  const [removeColors, setRemoveColors] = useState([]);
  /** @type {[Record<string, { past: string[]; future: string[] }>, Function]} */
  const [artHistory, setArtHistory] = useState({});
  const stageRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const fitLayerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const logoImgRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const dragStart = useRef({mx: 0, my: 0, x: 0.5, y: 0.36});
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const rightsRef = useRef(/** @type {HTMLLabelElement | null} */ (null));
  const locationsRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  /** Object-fit:contain box of the garment photo inside the square stage (%) */
  const [fitBox, setFitBox] = useState({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  });

  const activeArt = artByLocation[activeLocationId] || null;
  const activeMeta = locationOptions.find((l) => l.id === activeLocationId);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open) return;

    // Only reset wizard state when the modal opens — not when the parent
    // syncs colorCode after Confirm (that was bouncing users back to step 1).
    if (justOpened) {
      setStep(initialDesign?.locations?.length ? 'artwork' : 'color');
      setPendingColor(resolveStudioColorCode(colorCode, colors) || colorCode);
      setError(null);
      setRightsOk(false);
      setRightsNeedsAttention(false);
      setLocationsNeedAttention(false);
      setPickMode(false);
      setRemoveColors([]);
      setArtHistory({});
      if (initialDesign?.locations?.length) {
        setSelectedLocationIds(initialDesign.locations.map((l) => l.id));
        setActiveLocationId(initialDesign.locations[0].id);
        setArtByLocation(hydrateArt(initialDesign));
        setPrintStyle(initialDesign.printStyle || 'simple');
      } else {
        setSelectedLocationIds([]);
        setActiveLocationId(null);
      }
    }
  }, [open, colorCode, initialDesign, colors]);

  // When sibling colors load after open, rematch the PDP color onto a swatch.
  useEffect(() => {
    if (!open || step !== 'color' || !colors.length) return;
    const resolved = resolveStudioColorCode(pendingColor || colorCode, colors);
    if (resolved && resolved !== pendingColor) {
      setPendingColor(resolved);
    }
  }, [open, step, colors, colorCode, pendingColor]);

  useEffect(() => {
    // Reset pick targets when switching locations
    setRemoveColors([]);
    setPickMode(false);
  }, [activeLocationId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key !== 'Escape' || busy) return;
      if (pickMode) {
        setPickMode(false);
        return;
      }
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, busy, pickMode]);

  const toggleLocation = (id) => {
    setLocationsNeedAttention(false);
    setError(null);
    setSelectedLocationIds((prev) => {
      const on = prev.includes(id);
      if (on) {
        if (prev.length <= 1) {
          // Allow fully clearing selection
          setActiveLocationId(null);
          return [];
        }
        const next = prev.filter((x) => x !== id);
        if (activeLocationId === id) setActiveLocationId(next[0] || null);
        return next;
      }
      setActiveLocationId(id);
      return [...prev, id];
    });
  };

  const pushArtHistory = (locationId, previousDataUrl) => {
    if (!locationId || !previousDataUrl) return;
    setArtHistory((prev) => {
      const entry = prev[locationId] || {past: [], future: []};
      return {
        ...prev,
        [locationId]: {
          past: [...entry.past, previousDataUrl].slice(-25),
          future: [],
        },
      };
    });
  };

  const clearArtHistory = (locationId) => {
    if (!locationId) return;
    setArtHistory((prev) => {
      if (!prev[locationId]) return prev;
      const next = {...prev};
      delete next[locationId];
      return next;
    });
  };

  const handleUndoArt = () => {
    if (!activeLocationId || !activeArt?.logoDataUrl) return;
    const entry = artHistory[activeLocationId];
    if (!entry?.past?.length) return;
    const previous = entry.past[entry.past.length - 1];
    const current = activeArt.logoDataUrl;
    setArtHistory((prev) => ({
      ...prev,
      [activeLocationId]: {
        past: entry.past.slice(0, -1),
        future: [current, ...(entry.future || [])].slice(0, 25),
      },
    }));
    setArtByLocation((prev) => ({
      ...prev,
      [activeLocationId]: {
        ...prev[activeLocationId],
        logoDataUrl: previous,
      },
    }));
    setError(null);
  };

  const handleRedoArt = () => {
    if (!activeLocationId || !activeArt) return;
    const entry = artHistory[activeLocationId];
    if (!entry?.future?.length) return;
    const next = entry.future[0];
    const current = activeArt.logoDataUrl;
    setArtHistory((prev) => ({
      ...prev,
      [activeLocationId]: {
        past: [...(entry.past || []), current].slice(-25),
        future: entry.future.slice(1),
      },
    }));
    setArtByLocation((prev) => ({
      ...prev,
      [activeLocationId]: {
        ...prev[activeLocationId],
        logoDataUrl: next,
      },
    }));
    setError(null);
  };

  const updateActiveTransform = (patch) => {
    setArtByLocation((prev) => {
      const current = prev[activeLocationId];
      if (!current) return prev;
      return {
        ...prev,
        [activeLocationId]: {
          ...current,
          transform: {...current.transform, ...patch},
        },
      };
    });
  };

  const handleUpload = async (file) => {
    if (!file || !activeLocationId) return;
    setError(null);
    setBusy('upload');
    try {
      const dataUrl = await fileToDataUrl(file);
      const preset =
        locationOptions.find((l) => l.id === activeLocationId)?.transform ||
        DEFAULT_DESIGN_TRANSFORM;
      setArtByLocation((prev) => ({
        ...prev,
        [activeLocationId]: {
          logoDataUrl: dataUrl,
          originalDataUrl: dataUrl,
          transform: {...preset},
        },
      }));
      clearArtHistory(activeLocationId);
      setRemoveColors([]);
      setPickMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveBg = async () => {
    if (!activeArt?.logoDataUrl || !activeLocationId) return;
    setError(null);
    setBusy('remove-bg');
    try {
      const before = activeArt.logoDataUrl;
      const cut = await removeLogoBackground(before);
      pushArtHistory(activeLocationId, before);
      setArtByLocation((prev) => ({
        ...prev,
        [activeLocationId]: {
          ...prev[activeLocationId],
          logoDataUrl: cut,
          originalDataUrl:
            prev[activeLocationId]?.originalDataUrl ||
            prev[activeLocationId]?.logoDataUrl,
        },
      }));
      setPickMode(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove background. Try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const handleApplyColorRemove = async () => {
    if (!activeArt?.logoDataUrl || !removeColors.length || !activeLocationId) {
      return;
    }
    setError(null);
    setBusy('color-remove');
    try {
      // Apply on the current artwork so each remove stacks; undo steps back.
      const before = activeArt.logoDataUrl;
      const cut = await removeColorsFromImage(before, removeColors, 32);
      pushArtHistory(activeLocationId, before);
      setArtByLocation((prev) => ({
        ...prev,
        [activeLocationId]: {
          ...prev[activeLocationId],
          logoDataUrl: cut,
          originalDataUrl:
            prev[activeLocationId]?.originalDataUrl || before,
        },
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not remove selected colors.',
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreOriginal = () => {
    if (!activeArt?.originalDataUrl || !activeLocationId) return;
    if (activeArt.logoDataUrl !== activeArt.originalDataUrl) {
      pushArtHistory(activeLocationId, activeArt.logoDataUrl);
    }
    setArtByLocation((prev) => ({
      ...prev,
      [activeLocationId]: {
        ...prev[activeLocationId],
        logoDataUrl: prev[activeLocationId].originalDataUrl,
      },
    }));
    setRemoveColors([]);
    setError(null);
  };

  const handleLogoPointerDown = async (e) => {
    if (!activeArt?.logoDataUrl) return;

    if (pickMode) {
      e.preventDefault();
      e.stopPropagation();
      const img = logoImgRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const xNorm = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const yNorm = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      try {
        const sampled = await sampleImageColor(
          activeArt.logoDataUrl,
          xNorm,
          yNorm,
        );
        setRemoveColors((prev) => {
          const exists = prev.some(
            (c) => colorDistance(c, sampled) < 12,
          );
          if (exists) return prev;
          if (prev.length >= 6) return [...prev.slice(1), sampled];
          return [...prev, sampled];
        });
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not sample that color.',
        );
      }
      return;
    }

    onPointerDownLogo(e);
  };

  const orderedSelectedLocationIds = useMemo(
    () =>
      locationOptions
        .map((l) => l.id)
        .filter((id) => selectedLocationIds.includes(id)),
    [locationOptions, selectedLocationIds],
  );

  const locationsReady =
    orderedSelectedLocationIds.length > 0 &&
    orderedSelectedLocationIds.every((id) =>
      Boolean(artByLocation[id]?.logoDataUrl),
    );

  const handleSave = async () => {
    if (!locationsReady) {
      setError('Upload artwork for every selected location.');
      setStep('artwork');
      return;
    }
    if (!rightsOk) {
      setError(
        'Please check the box confirming you own or have permission to use this artwork, then click Save design.',
      );
      setRightsNeedsAttention(true);
      // Let the error bar + highlight paint, then bring the checkbox into view
      requestAnimationFrame(() => {
        rightsRef.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
      });
      return;
    }
    setRightsNeedsAttention(false);
    setError(null);
    setBusy('save');
    try {
      const primaryId = orderedSelectedLocationIds[0] || selectedLocationIds[0];
      const primary = artByLocation[primaryId];
      const locations = orderedSelectedLocationIds.map((id) => ({
        id,
        label: locationOptions.find((l) => l.id === id)?.label || id,
        logoDataUrl: artByLocation[id].logoDataUrl,
        transform: {...artByLocation[id].transform},
      }));

      const localDesign = {
        logoDataUrl: primary.logoDataUrl,
        transform: {...primary.transform},
        locations,
        printStyle,
        productHandle,
        productId,
        colorCode: pendingColor || colorCode,
        colorName,
        previewUrl: null,
        remoteId: null,
        viewMockups: /** @type {import('~/lib/designStudioApi').DesignViewMockup[]} */ (
          []
        ),
      };

      const imagePool =
        productImages?.length > 0
          ? productImages
          : productImage
            ? [productImage]
            : [];

      /** @type {Record<string, typeof locations>} */
      const logosByView = {};
      for (const loc of locations) {
        const view = garmentViewForLocation(LOCATION_CATALOG[loc.id]);
        if (!logosByView[view]) logosByView[view] = [];
        logosByView[view].push(loc);
      }

      /** @type {import('~/lib/designStudioApi').DesignViewMockup[]} */
      const viewMockups = [];
      for (const view of /** @type {Array<'front'|'back'|'side'>} */ ([
        'front',
        'back',
        'side',
      ])) {
        const logos = logosByView[view];
        if (!logos?.length) continue;
        const garment =
          pickGarmentViewImage(imagePool, view) || productImage || null;
        try {
          const dataUrl = await composeStageExactPreview({
            garmentUrl: garment?.url,
            logos,
            size: 1000,
          });
          if (dataUrl) {
            viewMockups.push({view, dataUrl, url: null});
          }
        } catch {
          // continue other views
        }
      }

      localDesign.viewMockups = viewMockups;
      const previewBase64 = viewMockups[0]?.dataUrl || null;

      try {
        const remote = await saveDesignRemote({
          productHandle,
          productId,
          colorCode: localDesign.colorCode,
          colorName,
          printStyle,
          locations: locations.map(({id, label, transform, logoDataUrl}) => ({
            id,
            label,
            transform,
            logoBase64: logoDataUrl,
          })),
          transform: localDesign.transform,
          logoBase64: primary.logoDataUrl,
          previewBase64: previewBase64 || undefined,
          viewMockups: viewMockups.map((m) => ({
            view: m.view,
            imageBase64: m.dataUrl,
          })),
        });
        if (remote?.id) {
          localDesign.remoteId = remote.id;
          localDesign.previewUrl =
            remote.previewUrl || remote.logoUrl || previewBase64 || null;
          if (Array.isArray(remote.viewMockups) && remote.viewMockups.length) {
            localDesign.viewMockups = remote.viewMockups.map((m) => ({
              view: m.view,
              url: m.url || null,
              dataUrl: null,
            }));
          } else if (previewBase64) {
            // Keep local baked mockups so PDP matches the studio
            localDesign.viewMockups = viewMockups;
          }
        } else {
          throw new Error(
            'Design API did not return a design ID. Check PUBLIC_DESIGN_API_URL and try saving again.',
          );
        }
      } catch (remoteErr) {
        console.warn('[designStudio] remote save failed', remoteErr);
        throw new Error(
          remoteErr instanceof Error
            ? remoteErr.message
            : 'Could not save design to the server. Try again before adding to cart.',
        );
      }

      onSave(localDesign);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const onPointerDownLogo = (e) => {
    if (!stageRef.current || !activeArt) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      x: activeArt.transform.x,
      y: activeArt.transform.y,
    };
  };

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging) return;
      const rect =
        fitLayerRef.current?.getBoundingClientRect() ||
        stageRef.current?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      const dx = (e.clientX - dragStart.current.mx) / rect.width;
      const dy = (e.clientY - dragStart.current.my) / rect.height;
      updateActiveTransform({
        x: clamp(dragStart.current.x + dx, 0.08, 0.92),
        y: clamp(dragStart.current.y + dy, 0.08, 0.92),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragging, activeLocationId],
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  const imagePool =
    productImages?.length > 0
      ? productImages
      : productImage
        ? [productImage]
        : [];
  const garmentView =
    step === 'artwork' || step === 'locations'
      ? garmentViewForLocation(activeMeta)
      : 'front';
  const displayImage =
    pickGarmentViewImage(imagePool, garmentView) || productImage || null;

  // Keep print/logo overlays aligned to the actual object-fit:contain photo
  // (square stage letterboxes portrait garment shots on mobile).
  useEffect(() => {
    if (!open || (step !== 'artwork' && step !== 'locations')) return;

    const updateFit = () => {
      const stage = stageRef.current;
      const img = stage?.querySelector('.design-studio-garment-frame img');
      if (!stage || !(img instanceof HTMLImageElement)) return;
      const sr = stage.getBoundingClientRect();
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh || !sr.width || !sr.height) {
        setFitBox({left: 0, top: 0, width: 100, height: 100});
        return;
      }
      const er = sr.width / sr.height;
      const ir = nw / nh;
      let cw;
      let ch;
      let ox;
      let oy;
      if (ir > er) {
        cw = sr.width;
        ch = sr.width / ir;
        ox = 0;
        oy = (sr.height - ch) / 2;
      } else {
        ch = sr.height;
        cw = sr.height * ir;
        ox = (sr.width - cw) / 2;
        oy = 0;
      }
      setFitBox({
        left: (ox / sr.width) * 100,
        top: (oy / sr.height) * 100,
        width: (cw / sr.width) * 100,
        height: (ch / sr.height) * 100,
      });
    };

    updateFit();
    const stage = stageRef.current;
    const img = stage?.querySelector('.design-studio-garment-frame img');
    img?.addEventListener('load', updateFit);
    const ro =
      typeof ResizeObserver !== 'undefined' && stage
        ? new ResizeObserver(updateFit)
        : null;
    if (stage && ro) ro.observe(stage);
    window.addEventListener('resize', updateFit);
    return () => {
      img?.removeEventListener('load', updateFit);
      ro?.disconnect();
      window.removeEventListener('resize', updateFit);
    };
  }, [open, step, displayImage?.url, garmentView]);

  if (!open || typeof document === 'undefined') return null;

  const confirmedColorLabel =
    colors.find((c) => colorsMatch(c.code, pendingColor || colorCode))?.name ||
    colorName ||
    pendingColor ||
    colorCode ||
    'Selected color';

  const selectedStudioColorCode =
    colors.find((c) => colorsMatch(c.code, pendingColor || colorCode))?.code ||
    pendingColor ||
    colorCode;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    setError(null);
    if (step === 'color') {
      const resolved =
        resolveStudioColorCode(pendingColor || colorCode, colors) ||
        pendingColor ||
        colorCode;
      if (!resolved) {
        setError('Please select a garment color to continue.');
        return;
      }
      setPendingColor(resolved);
      onConfirmColor?.(resolved);
      setStep('locations');
      return;
    }
    if (step === 'locations') {
      if (!selectedLocationIds.length) {
        setError('Please select at least one decoration location to continue.');
        setLocationsNeedAttention(true);
        requestAnimationFrame(() => {
          locationsRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        });
        return;
      }
      setLocationsNeedAttention(false);
      // Always start artwork on the first selected location (catalog L→R order)
      setActiveLocationId(orderedSelectedLocationIds[0] || selectedLocationIds[0]);
      setStep('artwork');
      return;
    }
    if (step === 'artwork') {
      if (!locationsReady) {
        const missing = orderedSelectedLocationIds.find(
          (id) => !artByLocation[id]?.logoDataUrl,
        );
        if (missing) setActiveLocationId(missing);
        setError('Upload artwork for each selected location before continuing.');
        return;
      }
      setStep('print');
      return;
    }
    handleSave();
  };

  const goBack = () => {
    setError(null);
    if (step === 'locations') setStep('color');
    else if (step === 'artwork') setStep('locations');
    else if (step === 'print') {
      setActiveLocationId(
        orderedSelectedLocationIds[0] || selectedLocationIds[0] || null,
      );
      setStep('artwork');
    }
  };

  return createPortal(
    <div
      className="design-studio"
      role="dialog"
      aria-modal="true"
      aria-labelledby="design-studio-title"
    >
      <div className="design-studio-shell">
        <header className="design-studio-header">
          <div className="design-studio-header-text">
            <p className="design-studio-kicker">Design studio</p>
            <h2 id="design-studio-title" className="design-studio-title">
              {productTitle}
            </h2>
          </div>

          <nav className="design-studio-steps" aria-label="Design steps">
            {STEPS.map((s, i) => (
              <span key={s.id} className="design-studio-step-wrap">
                {i > 0 ? <span className="design-studio-step-sep" /> : null}
                <span
                  className={`design-studio-step ${
                    step === s.id
                      ? 'is-active'
                      : i < stepIndex
                        ? 'is-done'
                        : ''
                  }`}
                >
                  <span className="design-studio-step-num">{i + 1}</span>
                  {s.label}
                </span>
              </span>
            ))}
          </nav>

          <button
            type="button"
            className="design-studio-close"
            onClick={onClose}
            disabled={Boolean(busy)}
            aria-label="Close design studio"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        {step === 'color' ? (
          <div className="design-studio-pane design-studio-pane--split">
            <div className="design-studio-pane-visual">
              {displayImage?.url ? (
                <div className="design-studio-garment-card">
                  <HydrogenImage
                    data={displayImage}
                    sizes="(min-width: 60em) 42vw, 90vw"
                  />
                </div>
              ) : (
                <div className="design-studio-garment-card is-empty" />
              )}
            </div>
            <div className="design-studio-pane-copy">
              <h3 className="design-studio-heading">Confirm garment color</h3>
              <p className="design-studio-copy">
                Lock in the blank color first. You can still preview your saved
                design on sibling colors after you finish.
              </p>

              {colors.length > 0 ? (
                <>
                  <div className="design-studio-color-picker">
                    <div className="color-selector-label">
                      <label htmlFor="design-studio-color-dropdown">
                        Selected Color
                      </label>
                    </div>
                    <ColorDropdown
                      triggerId="design-studio-color-dropdown"
                      colors={colors}
                      selectedColor={selectedStudioColorCode}
                      onColorSelect={(code) => {
                        setPendingColor(code);
                        onConfirmColor?.(code);
                      }}
                    />
                  </div>
                  <div className="design-studio-swatches" role="listbox">
                    {colors.map((c) => {
                      const selected = colorsMatch(pendingColor, c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`design-studio-swatch ${
                            selected ? 'is-selected' : ''
                          }`}
                          style={{
                            background: c.code.startsWith('#')
                              ? c.code
                              : `#${c.code}`,
                          }}
                          title={c.name || c.code}
                          onClick={() => {
                            setPendingColor(c.code);
                            onConfirmColor?.(c.code);
                          }}
                        />
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 'locations' ? (
          <div className="design-studio-pane design-studio-pane--locations">
            <div className="design-studio-pane-intro">
              <h3 className="design-studio-heading">Decoration locations</h3>
              <p className="design-studio-copy">
                Pick every place you want decorated. You&apos;ll upload artwork
                for each one next.
              </p>
            </div>
            <div
              ref={locationsRef}
              className={`design-studio-location-grid${
                locationsNeedAttention ? ' is-attention' : ''
              }`}
            >
              {locationOptions.map((loc) => {
                const selected = selectedLocationIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    className={`design-studio-location-card ${
                      selected ? 'is-selected' : ''
                    }`}
                    aria-pressed={selected}
                    onClick={() => toggleLocation(loc.id)}
                  >
                    <LocationGlyph id={loc.id} active={selected} />
                    <span className="design-studio-location-card-text">
                      <span className="design-studio-location-card-label">
                        {loc.label}
                      </span>
                      <span className="design-studio-location-card-desc">
                        {loc.description}
                      </span>
                    </span>
                    <span
                      className={`design-studio-location-check ${
                        selected ? 'is-on' : ''
                      }`}
                      aria-hidden
                    >
                      {selected ? <Check size={14} strokeWidth={2.5} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 'artwork' ? (
          <div className="design-studio-pane design-studio-pane--artwork">
            <div className="design-studio-stage-wrap">
              <div
                ref={stageRef}
                className={`design-studio-stage ${dragging ? 'is-dragging' : ''}`}
              >
                <div className="design-studio-stage-side" aria-live="polite">
                  <span className="design-studio-stage-side-kicker">
                    Designing
                  </span>
                  <span className="design-studio-stage-side-label">
                    {activeMeta?.label || 'Location'}
                    {garmentView === 'back'
                      ? ' · Back'
                      : garmentView === 'side'
                        ? ' · Side'
                        : ' · Front'}
                  </span>
                </div>
                {displayImage?.url ? (
                  <div className="design-studio-garment-frame">
                    <HydrogenImage
                      data={displayImage}
                      sizes="(min-width: 60em) 48vw, 100vw"
                    />
                  </div>
                ) : (
                  <div className="design-studio-garment is-empty" />
                )}
                <div
                  ref={fitLayerRef}
                  className="design-studio-fit-layer"
                  style={{
                    left: `${fitBox.left}%`,
                    top: `${fitBox.top}%`,
                    width: `${fitBox.width}%`,
                    height: `${fitBox.height}%`,
                  }}
                >
                  {activeMeta?.transform ? (
                    <div
                      className={`design-studio-placement-guide design-studio-placement-guide--${
                        activeMeta.id
                      }${
                        activeArt?.logoDataUrl ? ' is-filled' : ' is-empty'
                      }`}
                      style={{
                        left: `${activeMeta.transform.x * 100}%`,
                        top: `${activeMeta.transform.y * 100}%`,
                        width: `${activeMeta.transform.scale * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${
                          activeMeta.transform.rotation || 0
                        }deg)`,
                      }}
                      aria-hidden={!activeArt?.logoDataUrl}
                    >
                      {!activeArt?.logoDataUrl ? (
                        <span className="design-studio-placement-guide-copy">
                          <span className="design-studio-placement-guide-title">
                            Print area
                          </span>
                          <span className="design-studio-placement-guide-sub">
                            {activeMeta.label}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {activeArt?.logoDataUrl ? (
                    <img
                      ref={logoImgRef}
                      src={activeArt.logoDataUrl}
                      alt={`${activeMeta?.label || 'Design'} artwork`}
                      className={`design-studio-logo ${
                        pickMode ? 'is-picking' : ''
                      }`}
                      draggable={false}
                      onPointerDown={handleLogoPointerDown}
                      style={{
                        left: `${activeArt.transform.x * 100}%`,
                        top: `${activeArt.transform.y * 100}%`,
                        width: `${activeArt.transform.scale * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${activeArt.transform.rotation}deg)`,
                      }}
                    />
                  ) : null}
                </div>
                {pickMode && activeArt?.logoDataUrl ? (
                  <div className="design-studio-pick-banner">
                    Click the artwork to select colors to remove
                  </div>
                ) : null}
              </div>
            </div>

            <div className="design-studio-tools">
              <div className="design-studio-loc-tabs" role="tablist">
                {orderedSelectedLocationIds.map((id) => {
                  const meta = locationOptions.find((l) => l.id === id);
                  const hasArt = Boolean(artByLocation[id]?.logoDataUrl);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={activeLocationId === id}
                      className={`design-studio-loc-tab ${
                        activeLocationId === id ? 'is-active' : ''
                      } ${hasArt ? 'has-art' : ''}`}
                      onClick={() => setActiveLocationId(id)}
                    >
                      {meta?.label || id}
                    </button>
                  );
                })}
              </div>

              <div className="design-studio-tools-block">
                <h3 className="design-studio-tools-title">
                  Artwork · {activeMeta?.label || 'Location'}
                </h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="design-studio-file-input"
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="design-studio-tool-btn design-studio-tool-btn--primary"
                  disabled={Boolean(busy)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} aria-hidden />
                  {activeArt?.logoDataUrl ? 'Replace artwork' : 'Upload artwork'}
                </button>
              </div>

              <div className="design-studio-tools-block">
                <h3 className="design-studio-tools-title">Clean up</h3>
                <button
                  type="button"
                  className={`design-studio-tool-btn ${
                    pickMode ? 'is-active-tool' : ''
                  }`}
                  disabled={!activeArt?.logoDataUrl || Boolean(busy)}
                  onClick={() => setPickMode((v) => !v)}
                >
                  <Pipette size={18} aria-hidden />
                  {pickMode ? 'Done picking colors' : 'Pick colors to remove'}
                </button>

                {removeColors.length > 0 ? (
                  <div className="design-studio-color-chips">
                    {removeColors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        className="design-studio-color-chip"
                        title={`Remove ${c.hex} (click to drop)`}
                        style={{background: c.hex}}
                        onClick={() =>
                          setRemoveColors((prev) =>
                            prev.filter((x) => x.hex !== c.hex),
                          )
                        }
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="design-studio-quick-colors">
                  <button
                    type="button"
                    className="design-studio-quick-color"
                    disabled={!activeArt?.logoDataUrl || Boolean(busy)}
                    onClick={() =>
                      setRemoveColors((prev) =>
                        upsertColor(prev, {r: 255, g: 255, b: 255, hex: '#FFFFFF'}),
                      )
                    }
                  >
                    <span
                      className="design-studio-quick-swatch"
                      style={{background: '#fff'}}
                    />
                    White
                  </button>
                  <button
                    type="button"
                    className="design-studio-quick-color"
                    disabled={!activeArt?.logoDataUrl || Boolean(busy)}
                    onClick={() =>
                      setRemoveColors((prev) =>
                        upsertColor(prev, {r: 0, g: 0, b: 0, hex: '#000000'}),
                      )
                    }
                  >
                    <span
                      className="design-studio-quick-swatch"
                      style={{background: '#111'}}
                    />
                    Black
                  </button>
                </div>

                <div className="design-studio-history-row">
                  <button
                    type="button"
                    className="design-studio-tool-btn design-studio-tool-btn--ghost"
                    disabled={
                      !artHistory[activeLocationId || '']?.past?.length ||
                      Boolean(busy)
                    }
                    onClick={handleUndoArt}
                    title="Undo last clean-up step"
                  >
                    <Undo2 size={18} aria-hidden />
                    Undo
                  </button>
                  <button
                    type="button"
                    className="design-studio-tool-btn design-studio-tool-btn--ghost"
                    disabled={
                      !artHistory[activeLocationId || '']?.future?.length ||
                      Boolean(busy)
                    }
                    onClick={handleRedoArt}
                    title="Redo clean-up step"
                  >
                    <Redo2 size={18} aria-hidden />
                    Redo
                  </button>
                </div>

                <button
                  type="button"
                  className="design-studio-tool-btn design-studio-tool-btn--primary"
                  disabled={
                    !activeArt?.logoDataUrl ||
                    !removeColors.length ||
                    Boolean(busy)
                  }
                  onClick={handleApplyColorRemove}
                >
                  {busy === 'color-remove' ? (
                    <Loader2 size={18} className="is-spin" aria-hidden />
                  ) : (
                    <Eraser size={18} aria-hidden />
                  )}
                  Remove selected colors
                </button>

                <div className="design-studio-tools-grid">
                  <button
                    type="button"
                    className="design-studio-tool-btn design-studio-tool-btn--ghost"
                    disabled={
                      !activeArt?.originalDataUrl ||
                      activeArt.logoDataUrl === activeArt.originalDataUrl ||
                      Boolean(busy)
                    }
                    onClick={handleRestoreOriginal}
                  >
                    <RotateCcw size={18} aria-hidden />
                    Restore original
                  </button>

                  <button
                    type="button"
                    className="design-studio-tool-btn design-studio-tool-btn--ghost"
                    disabled={!activeArt?.logoDataUrl || Boolean(busy)}
                    onClick={handleRemoveBg}
                  >
                    {busy === 'remove-bg' ? (
                      <Loader2 size={18} className="is-spin" aria-hidden />
                    ) : (
                      <Wand2 size={18} aria-hidden />
                    )}
                    Auto clean
                  </button>
                </div>
                <p className="design-studio-hint">
                  Tip: pick background colors to remove (often white), then use
                  Undo / Redo to step through changes. Auto clean can over-erase
                  detailed logos.
                </p>
              </div>

              <div className="design-studio-tools-block">
                <h3 className="design-studio-tools-title">Placement</h3>
                <label className="design-studio-slider-label">
                  Size
                  <input
                    type="range"
                    min={0.08}
                    max={0.7}
                    step={0.01}
                    value={activeArt?.transform.scale ?? 0.36}
                    disabled={!activeArt}
                    onChange={(e) =>
                      updateActiveTransform({scale: Number(e.target.value)})
                    }
                  />
                </label>
                <label className="design-studio-slider-label">
                  Rotate
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={activeArt?.transform.rotation ?? 0}
                    disabled={!activeArt}
                    onChange={(e) =>
                      updateActiveTransform({
                        rotation: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="design-studio-tool-btn design-studio-tool-btn--ghost"
                  disabled={!activeArt}
                  onClick={() => {
                    const preset =
                      activeMeta?.transform || DEFAULT_DESIGN_TRANSFORM;
                    updateActiveTransform({...preset});
                  }}
                >
                  <RotateCcw size={18} aria-hidden />
                  Reset placement
                </button>
                <p className="design-studio-hint">
                  Drag artwork on the garment to fine-tune position.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'print' ? (
          <div className="design-studio-pane design-studio-pane--print">
            <div className="design-studio-pane-intro">
              <h3 className="design-studio-heading">Print style</h3>
              <p className="design-studio-copy">
                Choose how we decorate. Our art team will still proof everything
                before production.
              </p>
            </div>
            <div className="design-studio-print-grid">
              {PRINT_STYLES.map((style) => {
                const selected = printStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    className={`design-studio-print-card ${
                      selected ? 'is-selected' : ''
                    }`}
                    aria-pressed={selected}
                    onClick={() => setPrintStyle(/** @type {'simple' | 'full'} */ (style.id))}
                  >
                    <span className="design-studio-print-card-top">
                      <span className="design-studio-print-eyebrow">
                        {style.eyebrow}
                      </span>
                      <span
                        className={`design-studio-location-check ${
                          selected ? 'is-on' : ''
                        }`}
                      >
                        {selected ? (
                          <Check size={14} strokeWidth={2.5} />
                        ) : null}
                      </span>
                    </span>
                    <span className="design-studio-print-label">
                      {style.label}
                    </span>
                    <ul className="design-studio-print-points">
                      {style.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <label
              ref={rightsRef}
              className={`design-studio-rights${
                rightsNeedsAttention && !rightsOk ? ' is-attention' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={rightsOk}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRightsOk(checked);
                  if (checked) {
                    setRightsNeedsAttention(false);
                    setError(null);
                  }
                }}
              />
              <span>
                I own the rights to this artwork, or have permission from the
                owner to use it.
              </span>
            </label>

            <p className="design-studio-summary">
              {confirmedColorLabel} · {selectedLocationIds.length} location
              {selectedLocationIds.length === 1 ? '' : 's'} ·{' '}
              {printStyle === 'full' ? 'Full color' : 'Simple color'}
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="design-studio-error-bar" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="design-studio-footer">
          <button
            type="button"
            className="design-studio-tool-btn design-studio-tool-btn--ghost"
            onClick={step === 'color' ? onClose : goBack}
            disabled={Boolean(busy)}
          >
            {step === 'color' ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft size={18} aria-hidden />
                Back
              </>
            )}
          </button>

          <button
            type="button"
            className="solid-button solid-button--pastel-sky design-studio-primary"
            onClick={goNext}
            disabled={Boolean(busy)}
          >
            {busy === 'save' ? (
              <>
                <Loader2 size={18} className="button-icon is-spin" />
                Saving…
              </>
            ) : step === 'print' ? (
              <>
                Save design
                <Check size={18} className="button-icon" aria-hidden />
              </>
            ) : (
              <>
                Continue
                <ChevronRight size={18} className="button-icon" aria-hidden />
              </>
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/**
 * @param {import('~/lib/designStudioApi').SavedProductDesign | null | undefined} design
 */
function hydrateArt(design) {
  /** @type {Record<string, { logoDataUrl: string; originalDataUrl: string; transform: typeof DEFAULT_DESIGN_TRANSFORM }>} */
  const map = {};
  if (design?.locations?.length) {
    for (const loc of design.locations) {
      if (loc.logoDataUrl) {
        map[loc.id] = {
          logoDataUrl: loc.logoDataUrl,
          originalDataUrl: loc.logoDataUrl,
          transform: loc.transform || {...DEFAULT_DESIGN_TRANSFORM},
        };
      }
    }
    return map;
  }
  if (design?.logoDataUrl) {
    map['front-center'] = {
      logoDataUrl: design.logoDataUrl,
      originalDataUrl: design.logoDataUrl,
      transform: design.transform || {...DEFAULT_DESIGN_TRANSFORM},
    };
  }
  return map;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * @param {Array<{ r: number; g: number; b: number; hex: string }>} prev
 * @param {{ r: number; g: number; b: number; hex: string }} color
 */
function upsertColor(prev, color) {
  if (prev.some((c) => c.hex === color.hex)) return prev;
  if (prev.length >= 6) return [...prev.slice(1), color];
  return [...prev, color];
}

/** Simple on-brand silhouette glyphs for location cards */
function LocationGlyph({id, active}) {
  const mark = active ? 'var(--p1-pastel-sky)' : '#cbd5e1';
  const body = active ? '#0a0a0a' : '#94a3b8';

  if (id.startsWith('hat')) {
    return (
      <svg className="design-studio-glyph" viewBox="0 0 64 64" aria-hidden>
        <path
          d="M10 38c2-14 14-22 22-22s20 8 22 22v4H10v-4z"
          fill="none"
          stroke={body}
          strokeWidth="2.5"
        />
        <ellipse cx="32" cy="42" rx="24" ry="6" fill="none" stroke={body} strokeWidth="2.5" />
        <rect
          x={id === 'hat-side' ? 14 : 24}
          y={id === 'hat-side' ? 28 : 24}
          width={id === 'hat-side' ? 10 : 16}
          height={id === 'hat-side' ? 10 : 14}
          rx="2"
          fill={mark}
        />
      </svg>
    );
  }

  const boxes = {
    'front-center': {x: 24, y: 26, w: 16, h: 16},
    'left-chest': {x: 35, y: 22, w: 9, h: 9},
    'back-center': {x: 24, y: 26, w: 16, h: 16},
    'back-neck': {x: 28, y: 16, w: 8, h: 6},
    'left-sleeve': {x: 6, y: 28, w: 8, h: 10},
    'right-sleeve': {x: 50, y: 28, w: 8, h: 10},
  };
  const box = boxes[id] || boxes['front-center'];

  return (
    <svg className="design-studio-glyph" viewBox="0 0 64 64" aria-hidden>
      <path
        d="M22 14l-8 6v10l6 2v24h24V32l6-2V20l-8-6-4 4h-12l-4-4z"
        fill="none"
        stroke={body}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="2" fill={mark} />
    </svg>
  );
}
