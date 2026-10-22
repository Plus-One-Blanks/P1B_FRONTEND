import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {CartForm} from '@shopify/hydrogen';
import {useFetcher, useNavigate} from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Upload,
} from 'lucide-react';
import {removeEdgeBackground} from '~/lib/designStudioApi';
import {saveGangSheetRemote} from '~/lib/dtfGangSheetApi';
import {
  detectSolidBackground,
  loadImageDims,
  readFileAsDataUrl,
} from '~/lib/dtfGangSheetHelpers';
import {
  FREE_SAMPLE_PRODUCT_HANDLE,
  FREE_SAMPLE_QUESTIONS,
  FREE_SAMPLE_SIZES,
  FREE_SAMPLE_STEPS,
  FREE_SAMPLE_VARIANTS,
} from '~/lib/freeSampleConstants';
import {buildFreeSampleLineAttributes} from '~/lib/freeSampleOrderAttributes';
import {BackgroundDetectModal} from '~/components/DtfGangSheet/modals/BackgroundDetectModal';
import {RemoveBgCompareModal} from '~/components/DtfGangSheet/modals/RemoveBgCompareModal';

/**
 * @param {{
 *   product: {
 *     id?: string;
 *     handle?: string;
 *     title?: string;
 *     featuredImage?: { url?: string | null; altText?: string | null } | null;
 *     variants?: {
 *       nodes?: Array<{
 *         id: string;
 *         title: string;
 *         availableForSale?: boolean;
 *         price?: { amount?: string; currencyCode?: string };
 *       }>;
 *     };
 *   } | null;
 * }} props
 */
export function FreeSampleFlow({product}) {
  const navigate = useNavigate();
  const cartFetcher = useFetcher();
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const cartRedirectRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const step = FREE_SAMPLE_STEPS[stepIndex] || 'experience';

  const [answers, setAnswers] = useState(
    /** @type {Record<string, string>} */ ({}),
  );
  const [sizeId, setSizeId] = useState(/** @type {string | null} */ (null));

  /** @type {[{ fileName: string; dataUrl: string; originalDataUrl: string; bgRemoved: boolean } | null, Function]} */
  const [artwork, setArtwork] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [detectOpen, setDetectOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [pendingDetect, setPendingDetect] = useState(
    /** @type {{ fileName: string; originalDataUrl: string; bgHex: string } | null} */ (
      null
    ),
  );
  const [cleanedPreview, setCleanedPreview] = useState(
    /** @type {string | null} */ (null),
  );

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const progress = ((stepIndex + 1) / FREE_SAMPLE_STEPS.length) * 100;
  const selectedSize =
    FREE_SAMPLE_SIZES.find((s) => s.id === sizeId) || null;

  useEffect(() => {
    window.scrollTo({top: 0, behavior: 'auto'});
  }, [stepIndex]);

  const variants = product?.variants?.nodes || [];
  const findVariant = useCallback(
    (optionTitle) =>
      variants.find(
        (v) =>
          v.title === optionTitle ||
          v.title?.includes(optionTitle) ||
          optionTitle.includes(v.title),
      ) || null,
    [variants],
  );

  useEffect(() => {
    if (!adding) return;
    if (cartFetcher.state !== 'idle') return;
    if (!cartFetcher.data) return;

    const errors = cartFetcher.data?.errors || cartFetcher.data?.cart?.errors;
    if (Array.isArray(errors) && errors.length) {
      setAdding(false);
      setError(errors[0]?.message || 'Could not add sample to cart.');
      return;
    }

    if (!cartRedirectRef.current) {
      cartRedirectRef.current = true;
      navigate('/cart');
    }
  }, [adding, cartFetcher.state, cartFetcher.data, navigate]);

  function goNext() {
    setError(null);
    setStepIndex((i) => Math.min(FREE_SAMPLE_STEPS.length - 1, i + 1));
  }

  function goPrev() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  /**
   * @param {string} questionId
   * @param {string} optionId
   */
  function selectAnswer(questionId, optionId) {
    setAnswers((prev) => ({...prev, [questionId]: optionId}));
    window.setTimeout(() => goNext(), 180);
  }

  /**
   * @param {FileList | File[] | null} fileList
   */
  async function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !file.type.startsWith('image/')) {
      setError('Please upload a PNG, JPG, or WEBP under 25 MB.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('File must be 25 MB or smaller.');
      return;
    }

    setUploadBusy(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await loadImageDims(dataUrl);
      const detect = await detectSolidBackground(dataUrl);
      if (detect.detected && detect.hex) {
        setPendingDetect({
          fileName: file.name,
          originalDataUrl: dataUrl,
          bgHex: detect.hex,
        });
        setDetectOpen(true);
      } else {
        setArtwork({
          fileName: file.name,
          dataUrl,
          originalDataUrl: dataUrl,
          bgRemoved: false,
        });
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function keepBackgroundAsIs() {
    if (!pendingDetect) return;
    setArtwork({
      fileName: pendingDetect.fileName,
      dataUrl: pendingDetect.originalDataUrl,
      originalDataUrl: pendingDetect.originalDataUrl,
      bgRemoved: false,
    });
    setDetectOpen(false);
    setPendingDetect(null);
  }

  async function startRemoveBackground() {
    if (!pendingDetect) return;
    setBgBusy(true);
    setError(null);
    try {
      const cleaned = await removeEdgeBackground(pendingDetect.originalDataUrl, {
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
    if (!pendingDetect || !cleanedPreview) return;
    setArtwork({
      fileName: pendingDetect.fileName,
      dataUrl: cleanedPreview,
      originalDataUrl: pendingDetect.originalDataUrl,
      bgRemoved: true,
    });
    setCompareOpen(false);
    setPendingDetect(null);
    setCleanedPreview(null);
  }

  function keepOriginalFromCompare() {
    if (!pendingDetect) return;
    setArtwork({
      fileName: pendingDetect.fileName,
      dataUrl: pendingDetect.originalDataUrl,
      originalDataUrl: pendingDetect.originalDataUrl,
      bgRemoved: false,
    });
    setCompareOpen(false);
    setPendingDetect(null);
    setCleanedPreview(null);
  }

  /**
   * @param {'free'} [offerId]
   */
  async function claimOffer(offerId = 'free') {
    if (!artwork || !selectedSize) {
      setError('Please upload artwork and choose a sample size first.');
      return;
    }

    const freeVar = findVariant(FREE_SAMPLE_VARIANTS.free.optionTitle);
    const kitVar = findVariant(FREE_SAMPLE_VARIANTS.kit.optionTitle);

    if (!freeVar) {
      setError(
        'Free sample product is not set up yet. Run scripts/create-free-sample-product.js',
      );
      return;
    }

    setAdding(true);
    setError(null);

    let sheetId = null;
    let artworkUrl = null;
    try {
      const saved = await saveGangSheetRemote({
        sheetSize: 'sample',
        sheetWidthIn: selectedSize.widthIn,
        sheetHeightIn: selectedSize.heightIn,
        productHandle: FREE_SAMPLE_PRODUCT_HANDLE,
        productId: product?.id || null,
        designName: `Free sample · ${selectedSize.title}`,
        previewBase64: artwork.dataUrl,
        items: [
          {
            id: `fs-${Date.now()}`,
            label: artwork.fileName,
            transform: {x: 0, y: 0, scale: 1, rotation: 0},
            imageBase64: artwork.dataUrl,
            widthIn: selectedSize.widthIn,
            heightIn: selectedSize.heightIn,
          },
        ],
      });
      if (saved) {
        sheetId = saved.id || null;
        artworkUrl = saved.previewUrl || null;
      }
    } catch (e) {
      console.warn('[free-sample] save artwork failed', e);
    }

    const placementLabel = selectedSize.title;
    const printSizeLabel = `${selectedSize.widthIn}" × ${selectedSize.heightIn}"`;
    const answersNote = FREE_SAMPLE_QUESTIONS.map((q) => {
      const opt = q.options.find((o) => o.id === answers[q.id]);
      return opt ? `${q.label}: ${opt.label}` : null;
    })
      .filter(Boolean)
      .join(' · ');

    const customAttrs = buildFreeSampleLineAttributes({
      sampleItem: 'Custom artwork transfer',
      placementLabel,
      printSizeLabel,
      artworkLabel: artwork.fileName,
      artworkUrl,
      sheetId,
      offerId: 'free',
      fileName: artwork.fileName,
    });
    if (answersNote) {
      customAttrs.push({
        key: 'Sample profile',
        value:
          answersNote.length > 250
            ? `${answersNote.slice(0, 247)}...`
            : answersNote,
      });
    }

    const kitAttrs = buildFreeSampleLineAttributes({
      sampleItem: 'Plus 1 sample kit',
      offerId: 'free',
    });

    /** @type {Array<{ merchandiseId: string; quantity: number; attributes: Array<{ key: string; value: string }> }>} */
    const lines = [
      {
        merchandiseId: freeVar.id,
        quantity: 1,
        attributes: customAttrs,
      },
    ];
    if (kitVar) {
      lines.push({
        merchandiseId: kitVar.id,
        quantity: 1,
        attributes: kitAttrs,
      });
    }

    cartRedirectRef.current = false;
    const formData = new FormData();
    formData.set(
      CartForm.INPUT_NAME,
      JSON.stringify({
        action: CartForm.ACTIONS.LinesAdd,
        inputs: {lines},
      }),
    );
    cartFetcher.submit(formData, {method: 'post', action: '/cart'});
  }

  const question =
    FREE_SAMPLE_QUESTIONS.find((q) => q.id === step) || null;

  return (
    <div className="free-sample">
      <div className="free-sample-body">
        {step === 'experience' ? (
          <LandingStep
            answers={answers}
            onSelect={(id) => selectAnswer('experience', id)}
            onStart={() => {
              if (answers.experience) goNext();
              else {
                const el = document.getElementById('free-sample-q');
                el?.scrollIntoView({behavior: 'smooth', block: 'center'});
              }
            }}
          />
        ) : (
          <div
            className={`free-sample-card${
              step === 'offer'
                ? ' free-sample-card--offer'
                : step === 'size'
                  ? ' free-sample-card--size'
                  : ''
            }`}
          >
            <div
              className="free-sample-progress"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{width: `${progress}%`}} />
            </div>

            {question ? (
              <QuestionStep
                question={question}
                selected={answers[question.id] || null}
                onSelect={(id) => selectAnswer(question.id, id)}
                heading={
                  question.id === 'about'
                    ? 'What best describes you?'
                    : question.id === 'volume'
                      ? 'How many garments are you doing with DTF each week?'
                      : 'What do you want to compare?'
                }
                onPrev={goPrev}
              />
            ) : null}

            {step === 'upload' ? (
              <UploadStep
                artwork={artwork}
                uploadBusy={uploadBusy}
                fileInputRef={fileInputRef}
                onPick={() => fileInputRef.current?.click()}
                onFiles={handleFiles}
                onClear={() => setArtwork(null)}
                onContinue={() => {
                  if (!artwork) {
                    setError('Choose artwork to continue.');
                    return;
                  }
                  goNext();
                }}
                onPrev={goPrev}
              />
            ) : null}

            {step === 'size' ? (
              <SizeStep
                sizeId={sizeId}
                onSelect={(id) => {
                  setSizeId(id);
                  window.setTimeout(() => goNext(), 180);
                }}
                onPrev={goPrev}
              />
            ) : null}

            {step === 'offer' ? (
              <OfferStep
                size={selectedSize}
                artwork={artwork}
                adding={adding}
                onClaim={claimOffer}
                onPrev={goPrev}
              />
            ) : null}

            {error ? (
              <p className="free-sample-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="free-sample-file-input"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <BackgroundDetectModal
        open={detectOpen}
        fileName={pendingDetect?.fileName || ''}
        previewUrl={pendingDetect?.originalDataUrl || ''}
        bgHex={pendingDetect?.bgHex || '#ffffff'}
        onKeep={keepBackgroundAsIs}
        onRemove={() => void startRemoveBackground()}
        onClose={keepBackgroundAsIs}
      />

      <RemoveBgCompareModal
        open={compareOpen}
        fileName={pendingDetect?.fileName || ''}
        originalUrl={pendingDetect?.originalDataUrl || ''}
        cleanedUrl={cleanedPreview || ''}
        busy={bgBusy}
        onApply={applyCleanedBackground}
        onCancel={keepOriginalFromCompare}
      />

      {adding ? (
        <div className="free-sample-adding" role="status">
          <div className="free-sample-adding-card">
            <Sparkles size={22} strokeWidth={2} />
            <p>Adding your free sample to cart…</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   answers: Record<string, string>;
 *   onSelect: (id: string) => void;
 *   onStart: () => void;
 * }} props
 */
function LandingStep({answers, onSelect, onStart}) {
  const q = FREE_SAMPLE_QUESTIONS[0];
  return (
    <div className="free-sample-landing">
      <article className="free-sample-hero-card">
        <h1>Upload Your Design. We Print It Free.</h1>
        <p className="free-sample-hero-sub">
          We print your custom DTF transfer and include a sample pack. You pay
          $0 today.
        </p>
        <div className="free-sample-hero-visual" aria-hidden>
          <span className="free-sample-hero-badge">Actual Plus 1 print</span>
          <div className="free-sample-hero-art">
            <span className="free-sample-hero-plus">+1</span>
          </div>
        </div>
        <ul className="free-sample-hero-feats">
          <li>
            <strong>You upload</strong>
            <span>Your design</span>
          </li>
          <li>
            <strong>We print</strong>
            <span>Custom DTF transfer</span>
          </li>
          <li>
            <strong>Included</strong>
            <span>Sample pack</span>
          </li>
        </ul>
        <p className="free-sample-hero-reviews">
          ★★★★★ <span>4.8 average · Built for apparel pros</span>
        </p>
        <button type="button" className="free-sample-cta" onClick={onStart}>
          Start my free sample
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </article>

      <article className="free-sample-card free-sample-card--landing" id="free-sample-q">
        <div className="free-sample-card-head">
          <span className="free-sample-step-label">{q.label}</span>
          <span className="free-sample-card-hint">
            Answer a few questions to get your free sample
          </span>
        </div>
        <h2 className="free-sample-q">Have you pressed DTF transfers before?</h2>
        <div className="free-sample-options free-sample-options--row">
          {q.options.map((opt) => (
            <OptionButton
              key={opt.id}
              label={opt.label}
              selected={answers.experience === opt.id}
              onClick={() => onSelect(opt.id)}
            />
          ))}
        </div>
        <p className="free-sample-card-foot">
          $0 custom sample · Your own artwork
        </p>
      </article>
    </div>
  );
}

/**
 * @param {{
 *   question: { id: string; label: string; options: Array<{ id: string; label: string }> };
 *   selected: string | null;
 *   onSelect: (id: string) => void;
 *   heading: string;
 *   onPrev: () => void;
 * }} props
 */
function QuestionStep({question, selected, onSelect, heading, onPrev}) {
  return (
    <>
      <span className="free-sample-step-label">{question.label}</span>
      <h2 className="free-sample-q">{heading}</h2>
      <div className="free-sample-options">
        {question.options.map((opt) => (
          <OptionButton
            key={opt.id}
            label={opt.label}
            selected={selected === opt.id}
            onClick={() => onSelect(opt.id)}
          />
        ))}
      </div>
      <PrevLink onClick={onPrev} />
    </>
  );
}

/**
 * @param {{
 *   artwork: { fileName: string; dataUrl: string; bgRemoved: boolean } | null;
 *   uploadBusy: boolean;
 *   fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
 *   onPick: () => void;
 *   onFiles: (files: FileList | null) => void;
 *   onClear: () => void;
 *   onContinue: () => void;
 *   onPrev: () => void;
 * }} props
 */
function UploadStep({
  artwork,
  uploadBusy,
  onPick,
  onFiles,
  onClear,
  onContinue,
  onPrev,
}) {
  const dropId = useId();
  return (
    <>
      <span className="free-sample-step-label">Your design</span>
      <p className="free-sample-eyebrow">Your custom press test</p>
      <h2 className="free-sample-q">Choose the artwork you want printed.</h2>
      <p className="free-sample-sub">
        We’ll print it as uploaded. A transparent PNG gives the cleanest result.
      </p>

      <aside className="free-sample-quote">
        <div className="free-sample-quote-avatar" aria-hidden>
          +1
        </div>
        <div>
          <p className="free-sample-quote-kicker">My only go-to</p>
          <p className="free-sample-quote-text">
            “Fastest service around. Fantastic prices, beautiful clear prints
            and so easy to use.”
          </p>
          <p className="free-sample-quote-by">
            <strong>Verified customer</strong>
          </p>
        </div>
      </aside>

      {!artwork ? (
        <button
          type="button"
          id={dropId}
          className="free-sample-drop"
          disabled={uploadBusy}
          onClick={onPick}
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
            void onFiles(e.dataTransfer.files);
          }}
        >
          <span className="free-sample-drop-icon">
            <Upload size={22} strokeWidth={2.25} />
          </span>
          <strong>{uploadBusy ? 'Reading artwork…' : 'Choose your artwork'}</strong>
          <span>PNG, JPG or WEBP · 25 MB max</span>
        </button>
      ) : (
        <div className="free-sample-art-ready">
          <div className="free-sample-art-thumb">
            <img src={artwork.dataUrl} alt="" />
          </div>
          <div className="free-sample-art-meta">
            <p className="free-sample-art-ready-title">
              <Check size={16} strokeWidth={2.5} aria-hidden />
              Your artwork is ready
            </p>
            <p className="free-sample-sub">
              We’ll use this exact file for your Press Test.
              {artwork.bgRemoved ? ' Background cleaned.' : ''}
            </p>
            <span className="free-sample-file-pill" title={artwork.fileName}>
              {artwork.fileName}
            </span>
            <button type="button" className="free-sample-link" onClick={onClear}>
              Choose a different file
            </button>
          </div>
        </div>
      )}

      {artwork ? (
        <button type="button" className="free-sample-cta" onClick={onContinue}>
          Choose where to print it
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
      <PrevLink onClick={onPrev} />
    </>
  );
}

/**
 * @param {{
 *   sizeId: string | null;
 *   onSelect: (id: string) => void;
 *   onPrev: () => void;
 * }} props
 */
function SizeStep({sizeId, onSelect, onPrev}) {
  return (
    <>
      <span className="free-sample-step-label">Sample size</span>
      <p className="free-sample-eyebrow">Your artwork is ready</p>
      <h2 className="free-sample-q">What do you want to sample for?</h2>
      <p className="free-sample-sub">
        Choose where you plan to press it. We’ll fit your artwork inside that
        print size without stretching it.
      </p>
      <div className="free-sample-sizes">
        {FREE_SAMPLE_SIZES.map((size) => (
          <button
            key={size.id}
            type="button"
            className={`free-sample-size${sizeId === size.id ? ' is-selected' : ''}`}
            onClick={() => onSelect(size.id)}
          >
            <span className="free-sample-size-radio" aria-hidden>
              {sizeId === size.id ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <PlacementIcon placement={size.placement} />
            <strong>{size.title}</strong>
            <span>{size.maxLabel}</span>
          </button>
        ))}
      </div>
      <PrevLink onClick={onPrev} />
    </>
  );
}

/**
 * @param {{
 *   size: { title: string; widthIn: number; heightIn: number } | null;
 *   artwork: { fileName: string; dataUrl: string; bgRemoved: boolean } | null;
 *   adding: boolean;
 *   onClaim: (offer?: 'free') => void;
 *   onPrev: () => void;
 * }} props
 */
function OfferStep({size, artwork, adding, onClaim, onPrev}) {
  const sizeBlurb = size
    ? `${size.title} · ${size.widthIn}" × ${size.heightIn}"`
    : 'Your requested custom sample';

  return (
    <>
      <span className="free-sample-step-label">Your press test</span>
      <div className="free-sample-offer-banner">
        <span className="free-sample-offer-art" aria-hidden>
          {artwork?.dataUrl ? (
            <img src={artwork.dataUrl} alt="" />
          ) : (
            <span className="free-sample-offer-art-fallback">+1</span>
          )}
        </span>
        <div>
          <p className="free-sample-eyebrow">Artwork ready</p>
          <h2 className="free-sample-q free-sample-q--sm">Choose your Press Test.</h2>
          <p className="free-sample-sub">
            {sizeBlurb}. Your requested custom sample and test kit are included.
          </p>
        </div>
      </div>

      <div className="free-sample-offers free-sample-offers--single">
        <article className="free-sample-offer free-sample-offer--free">
          <span className="free-sample-offer-rec">Recommended for you</span>
          <div className="free-sample-offer-main">
            <div className="free-sample-offer-copy">
              <p className="free-sample-offer-kicker">Try it free</p>
              <h3>Custom Sample + Test Kit</h3>
              <p className="free-sample-offer-price">$0 TODAY</p>
              <p className="free-sample-offer-desc">
                Get your requested custom sample and a Plus 1 test kit.
              </p>
              <p className="free-sample-offer-bar">
                Just pay shipping today. Press it, test it, then decide.
              </p>
            </div>
            <button
              type="button"
              className="free-sample-offer-cta free-sample-offer-cta--sky"
              disabled={adding}
              onClick={() => void onClaim('free')}
            >
              Get my free test
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </article>
      </div>

      <p className="free-sample-ship-note">
        Prints today · Ships next business day · Pay shipping at checkout
      </p>
      <PrevLink onClick={onPrev} />
    </>
  );
}

/**
 * @param {{ label: string; selected: boolean; onClick: () => void }} props
 */
function OptionButton({label, selected, onClick}) {
  return (
    <button
      type="button"
      className={`free-sample-option${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="free-sample-option-radio" aria-hidden>
        {selected ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}

/** @param {{ onClick: () => void }} props */
function PrevLink({onClick}) {
  return (
    <button type="button" className="free-sample-prev" onClick={onClick}>
      <ArrowLeft size={14} strokeWidth={2.25} aria-hidden />
      Previous
    </button>
  );
}

/**
 * T-shirt silhouette with print-area mark for each placement.
 * @param {{ placement: string }} props
 */
function PlacementIcon({placement}) {
  /** @type {Record<string, { x: number; y: number; w: number; h: number }>} */
  const marks = {
    sleeve: {x: 78, y: 28, w: 14, h: 14},
    'left-chest': {x: 54, y: 34, w: 16, h: 16},
    'center-chest': {x: 36, y: 34, w: 28, h: 28},
    'full-front': {x: 30, y: 32, w: 40, h: 44},
    'full-back': {x: 28, y: 30, w: 44, h: 52},
  };
  const mark = marks[placement] || marks['left-chest'];
  const isBack = placement === 'full-back';

  return (
    <span className="free-sample-tee" aria-hidden>
      {isBack ? <span className="free-sample-tee-back-label">BACK</span> : null}
      <svg
        className="free-sample-tee-svg"
        viewBox="0 0 100 110"
        width="72"
        height="80"
        fill="none"
      >
        {/* Shirt body */}
        <path
          className="free-sample-tee-body"
          d="M35 18
             C35 18 38 8 50 8
             C62 8 65 18 65 18
             L82 28
             L74 42
             L68 38
             L68 98
             L32 98
             L32 38
             L26 42
             L18 28
             Z"
        />
        {/* Collar */}
        <path
          className="free-sample-tee-collar"
          d="M42 16 C44 22 56 22 58 16"
        />
        {/* Print area */}
        <rect
          className="free-sample-tee-print"
          x={mark.x}
          y={mark.y}
          width={mark.w}
          height={mark.h}
          rx="2.5"
        />
      </svg>
    </span>
  );
}
