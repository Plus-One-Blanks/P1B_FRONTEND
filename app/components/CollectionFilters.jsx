import {
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import { SlidersHorizontal } from 'lucide-react';

/**
 * @typedef {{ type: string; label: string; value: string }} ActiveFilter
 */

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'name-asc', label: 'Name: A–Z' },
  { value: 'name-desc', label: 'Name: Z–A' },
];

/** Color keywords → display label + swatch (matches title/tags text) */
const COLOR_OPTIONS = [
  { label: 'Black', keywords: ['black', 'blk', 'jet black'], hex: '#1a1a1a' },
  { label: 'White', keywords: ['white', 'wht', 'bright white'], hex: '#f4f4f5' },
  { label: 'Grey', keywords: ['grey', 'gray', 'heather grey', 'heather gray', 'charcoal', 'ash'], hex: '#9ca3af' },
  { label: 'Navy', keywords: ['navy', 'midnight'], hex: '#1e3a5f' },
  { label: 'Blue', keywords: ['blue', 'royal', 'cobalt', 'indigo', 'aqua', 'turquoise'], hex: '#2563eb' },
  { label: 'Red', keywords: ['red', 'cardinal', 'maroon', 'burgundy'], hex: '#b91c1c' },
  { label: 'Green', keywords: ['green', 'olive', 'sage', 'forest', 'lime', 'army'], hex: '#15803d' },
  { label: 'Yellow', keywords: ['yellow', 'gold', 'mustard', 'banana'], hex: '#eab308' },
  { label: 'Orange', keywords: ['orange', 'safety orange', 'burnt orange'], hex: '#ea580c' },
  { label: 'Pink', keywords: ['pink', 'magenta', 'fuchsia'], hex: '#db2777' },
  { label: 'Purple', keywords: ['purple', 'violet', 'lavender', 'plum'], hex: '#7c3aed' },
  { label: 'Brown', keywords: ['brown', 'chocolate', 'coffee', 'tan', 'khaki', 'sand'], hex: '#78350f' },
  { label: 'Apricot', keywords: ['apricot', 'peach'], hex: '#fbceb1' },
];

function productText(product) {
  const title = (product.title || '').toLowerCase();
  const tags = Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : '';
  const desc = (product.description || '').toLowerCase();
  return `${title} ${tags} ${desc}`;
}

/**
 * @param {{
 *   title: string;
 *   active?: boolean;
 *   open: boolean;
 *   onToggle: () => void;
 *   children: import('react').ReactNode;
 * }}
 */
function MobileFilterSection({ title, active, open, onToggle, children }) {
  return (
    <div
      className={[
        'collection-filter-sheet-section',
        open && 'collection-filter-sheet-section--open',
        active && 'collection-filter-sheet-section--active',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="collection-filter-sheet-section-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="collection-filter-sheet-section-title">{title}</span>
        {active ? (
          <span className="collection-filter-sheet-section-active-dot" aria-hidden />
        ) : null}
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="collection-filter-sheet-section-body">{children}</div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`collection-filter-pill-chevron ${open ? 'collection-filter-pill-chevron--open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}

/**
 * @param {{
 *   products: Array<any>;
 *   onFilterChange: (filteredProducts: Array<any>) => void;
 *   onActiveFiltersChange?: (filters: ActiveFilter[]) => void;
 *   itemCount: number;
 *   chromeRootRef?: React.RefObject<HTMLElement | null>;
 * }}
 */
export const CollectionFilters = forwardRef(function CollectionFilters(
  { products, onFilterChange, onActiveFiltersChange, itemCount, chromeRootRef },
  ref
) {
  const [sortBy, setSortBy] = useState('featured');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedFabrics, setSelectedFabrics] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [openMenu, setOpenMenu] = useState(
    /** @type {null | 'brand' | 'material' | 'fabric' | 'color' | 'price' | 'sort'} */ (null)
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState(
    /** @type {null | 'brand' | 'material' | 'fabric' | 'color' | 'price'} */ (null),
  );

  const barRef = useRef(null);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  const closeMobileFilters = useCallback(() => {
    setMobileFiltersOpen(false);
    setMobileSection(null);
  }, []);

  const openMobileFilters = useCallback(() => {
    closeMenu();
    setMobileFiltersOpen(true);
  }, [closeMenu]);

  const toggleMobileSection = useCallback((id) => {
    setMobileSection((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const isInsideChrome = (/** @type {EventTarget | null} */ target) => {
      if (!(target instanceof Node)) return false;
      const root = chromeRootRef?.current ?? barRef.current;
      return Boolean(root?.contains(target));
    };

    const onPointerDownCapture = (e) => {
      if (isInsideChrome(e.target)) return;
      closeMenu();
    };

    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [closeMenu, chromeRootRef]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeMenu]);

  const toggleMenu = (id) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  };

  const activeFiltersList = useMemo(() => {
    const filters = /** @type {ActiveFilter[]} */ ([]);
    if (minPrice || maxPrice) {
      const min = minPrice ? `$${minPrice}` : 'Any';
      const max = maxPrice ? `$${maxPrice}` : 'Any';
      filters.push({ type: 'price', label: 'Price', value: `${min} - ${max}` });
    }
    selectedBrands.forEach((brand) => {
      filters.push({ type: 'brand', label: 'Brand', value: brand });
    });
    selectedMaterials.forEach((material) => {
      filters.push({ type: 'material', label: 'Material', value: material });
    });
    selectedFabrics.forEach((fabric) => {
      filters.push({ type: 'fabric', label: 'Fabric', value: fabric });
    });
    selectedColors.forEach((c) => {
      filters.push({ type: 'color', label: 'Color', value: c });
    });
    return filters;
  }, [minPrice, maxPrice, selectedBrands, selectedMaterials, selectedFabrics, selectedColors]);

  useImperativeHandle(ref, () => ({
    removeFilter(type, value) {
      switch (type) {
        case 'price':
          setMinPrice('');
          setMaxPrice('');
          break;
        case 'brand':
          setSelectedBrands((prev) => prev.filter((b) => b !== value));
          break;
        case 'material':
          setSelectedMaterials((prev) => prev.filter((m) => m !== value));
          break;
        case 'fabric':
          setSelectedFabrics((prev) => prev.filter((f) => f !== value));
          break;
        case 'color':
          setSelectedColors((prev) => prev.filter((c) => c !== value));
          break;
        default:
          break;
      }
    },
    clearAllFilters() {
      setSelectedBrands([]);
      setMinPrice('');
      setMaxPrice('');
      setSelectedMaterials([]);
      setSelectedFabrics([]);
      setSelectedColors([]);
      closeMenu();
      closeMobileFilters();
    },
  }));

  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMobileFilters();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileFiltersOpen, closeMobileFilters]);

  useEffect(() => {
    onActiveFiltersChange?.(activeFiltersList);
  }, [activeFiltersList, onActiveFiltersChange]);

  const brands = useMemo(() => {
    const brandSet = new Set();
    products.forEach((product) => {
      if (product.vendor) brandSet.add(product.vendor);
    });
    return Array.from(brandSet).sort();
  }, [products]);

  const brandOptions = useMemo(() => {
    return brands.map((name) => ({
      name,
      count: products.filter((p) => (p.vendor || '') === name).length,
    }));
  }, [brands, products]);

  const materials = useMemo(() => {
    const materialSet = new Set();
    const materialKeywords = [
      'cotton',
      'polyester',
      'poly',
      'blend',
      'tri-blend',
      'cvc',
      'jersey',
      'heather',
      'organic',
      'bamboo',
      'modal',
    ];

    products.forEach((product) => {
      const titleLower = (product.title || '').toLowerCase();
      const tagsLower = (product.tags || []).join(' ').toLowerCase();
      const searchText = `${titleLower} ${tagsLower}`;

      materialKeywords.forEach((keyword) => {
        if (searchText.includes(keyword)) {
          let materialName = keyword;
          if (keyword === 'poly') materialName = 'Polyester';
          else if (keyword === 'tri-blend') materialName = 'Tri-Blend';
          else if (keyword === 'cvc') materialName = 'CVC';
          else {
            materialName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          }
          materialSet.add(materialName);
        }
      });
    });
    return Array.from(materialSet).sort();
  }, [products]);

  const materialOptions = useMemo(() => {
    return materials.map((name) => ({
      name,
      count: products.filter((p) => {
        const t = `${(p.title || '').toLowerCase()} ${(p.tags || []).join(' ').toLowerCase()}`;
        return t.includes(name.toLowerCase());
      }).length,
    }));
  }, [materials, products]);

  const fabrics = useMemo(() => {
    const fabricMap = new Map();
    const allFabricTypes = [
      {
        name: '100% Cotton',
        searchTerms: ['100% cotton', '100%cotton', 'cotton 100%', 'cotton'],
      },
      {
        name: '100% Polyester',
        searchTerms: ['100% polyester', '100%polyester', 'polyester 100%', 'polyester'],
      },
      {
        name: 'Cotton/Poly Blend',
        searchTerms: [
          'cotton/poly',
          'cotton poly blend',
          'cotton/polyester',
          'cotton polyester blend',
          '50/50',
          '5050',
          'cotton poly',
          'cvc',
          '50/50 blend',
        ],
      },
      {
        name: 'Cotton/Spandex',
        searchTerms: ['cotton/spandex', 'cotton spandex', 'cotton spandex blend'],
      },
      { name: 'Organic', searchTerms: ['organic', 'organic cotton'] },
      { name: 'Performance', searchTerms: ['performance', 'performance fabric', 'athletic'] },
      { name: 'Polyester Blend', searchTerms: ['polyester blend', 'poly blend'] },
      { name: 'Rayon', searchTerms: ['rayon'] },
      { name: 'Recycled', searchTerms: ['recycled', 'recycled fabric'] },
      { name: 'Spandex', searchTerms: ['spandex'] },
      {
        name: 'Tri-Blend (Poly/Cotton/Rayon)',
        searchTerms: [
          'tri-blend',
          'tri blend',
          'poly/cotton/rayon',
          'poly cotton rayon',
          'triblend',
        ],
      },
    ];

    products.forEach((product) => {
      const searchText = productText(product);
      allFabricTypes.forEach(({ name, searchTerms }) => {
        const matches = searchTerms.some((term) => searchText.includes(term.toLowerCase()));
        if (matches) {
          fabricMap.set(name, (fabricMap.get(name) || 0) + 1);
        }
      });
    });

    return allFabricTypes.map(({ name }) => ({
      name,
      count: fabricMap.get(name) || 0,
    }));
  }, [products]);

  const colorOptions = useMemo(() => {
    return COLOR_OPTIONS.map(({ label, keywords, hex }) => {
      const count = products.filter((p) => {
        const text = productText(p);
        return keywords.some((kw) => text.includes(kw.toLowerCase()));
      }).length;
      return { label, hex, count };
    });
  }, [products]);

  const fabricSearchMap = useMemo(
    () => ({
      '100% Cotton': ['100% cotton', '100%cotton', 'cotton 100%'],
      '100% Polyester': ['100% polyester', '100%polyester', 'polyester 100%'],
      'Cotton/Poly Blend': [
        'cotton/poly',
        'cotton poly blend',
        'cotton/polyester',
        'cotton polyester blend',
        '50/50',
        '5050',
        'cotton poly',
        'cvc',
      ],
      'Cotton/Spandex': ['cotton/spandex', 'cotton spandex'],
      Organic: ['organic'],
      Performance: ['performance'],
      'Polyester Blend': ['polyester blend', 'poly blend'],
      Rayon: ['rayon'],
      Recycled: ['recycled'],
      Spandex: ['spandex'],
      'Tri-Blend (Poly/Cotton/Rayon)': [
        'tri-blend',
        'tri blend',
        'poly/cotton/rayon',
        'poly cotton rayon',
      ],
    }),
    []
  );

  /** Products matching non-price filters — slider min/max follow this set (“on screen” candidates). */
  const productsForPriceDomain = useMemo(() => {
    let filtered = [...products];
    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) =>
        selectedBrands.includes(product.vendor || ''),
      );
    }
    if (selectedMaterials.length > 0) {
      filtered = filtered.filter((product) => {
        const titleLower = (product.title || '').toLowerCase();
        const tagsLower = (product.tags || []).join(' ').toLowerCase();
        const searchText = `${titleLower} ${tagsLower}`;
        return selectedMaterials.some((material) =>
          searchText.includes(material.toLowerCase()),
        );
      });
    }
    if (selectedFabrics.length > 0) {
      filtered = filtered.filter((product) => {
        const searchText = productText(product);
        return selectedFabrics.some((fabricName) => {
          const searchTerms =
            fabricSearchMap[fabricName] || [fabricName.toLowerCase()];
          return searchTerms.some((term) =>
            searchText.includes(term.toLowerCase()),
          );
        });
      });
    }
    if (selectedColors.length > 0) {
      filtered = filtered.filter((product) => {
        const text = productText(product);
        return selectedColors.some((colorLabel) => {
          const opt = COLOR_OPTIONS.find((c) => c.label === colorLabel);
          if (!opt) return false;
          return opt.keywords.some((kw) => text.includes(kw.toLowerCase()));
        });
      });
    }
    return filtered;
  }, [
    products,
    selectedBrands,
    selectedMaterials,
    selectedFabrics,
    selectedColors,
    fabricSearchMap,
  ]);

  const priceSliderDomain = useMemo(() => {
    const prices = productsForPriceDomain
      .map((p) => parseFloat(p.priceRange?.minVariantPrice?.amount || 0))
      .filter((p) => p > 0 && Number.isFinite(p));
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [productsForPriceDomain]);

  const priceStep = useMemo(() => {
    const span = priceSliderDomain.max - priceSliderDomain.min;
    if (span <= 0) return 0.01;
    if (span > 400) return 1;
    if (span > 50) return 0.5;
    return 0.01;
  }, [priceSliderDomain]);

  const roundPrice = (n) => Math.round(n * 100) / 100;

  const { min: dMin, max: dMax } = priceSliderDomain;

  const lowNum = useMemo(() => {
    if (!Number.isFinite(dMin) || !Number.isFinite(dMax)) return 0;
    if (dMax < dMin) return dMin;
    if (minPrice === '') return dMin;
    const v = parseFloat(minPrice);
    if (!Number.isFinite(v)) return dMin;
    return Math.min(dMax, Math.max(dMin, v));
  }, [minPrice, dMin, dMax]);

  const highNum = useMemo(() => {
    if (!Number.isFinite(dMin) || !Number.isFinite(dMax)) return 0;
    if (dMax < dMin) return dMax;
    if (maxPrice === '') return dMax;
    const v = parseFloat(maxPrice);
    if (!Number.isFinite(v)) return dMax;
    return Math.min(dMax, Math.max(dMin, v));
  }, [maxPrice, dMin, dMax]);

  const displayLow = Math.min(lowNum, highNum);
  const displayHigh = Math.max(lowNum, highNum);

  const priceSliderPct = (v) =>
    dMax <= dMin ? 0 : ((v - dMin) / (dMax - dMin)) * 100;
  const pctLow = priceSliderPct(displayLow);
  const pctHigh = priceSliderPct(displayHigh);

  const pricePanelUnavailable =
    productsForPriceDomain.length === 0 ||
    dMax < dMin ||
    (dMin <= 0 && dMax <= 0);

  const commitPriceRange = (lo, hi) => {
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    const clampedLo = Math.max(dMin, Math.min(dMax, a));
    const clampedHi = Math.max(dMin, Math.min(dMax, b));
    if (clampedHi < clampedLo) return;
    const span = dMax - dMin;
    const eps = Math.max(priceStep * 0.5, span * 0.0001);
    const fullRange =
      span <= 0 ||
      (clampedLo <= dMin + eps && clampedHi >= dMax - eps);
    if (fullRange) {
      setMinPrice('');
      setMaxPrice('');
    } else {
      setMinPrice(String(roundPrice(clampedLo)));
      setMaxPrice(String(roundPrice(clampedHi)));
    }
  };

  const handlePriceSliderLow = (value) => {
    const v = Number(value);
    const maxAllowed = Math.max(dMin, displayHigh - priceStep);
    const next = Math.min(v, maxAllowed);
    commitPriceRange(next, displayHigh);
  };

  const handlePriceSliderHigh = (value) => {
    const v = Number(value);
    const minAllowed = Math.min(dMax, displayLow + priceStep);
    const next = Math.max(v, minAllowed);
    commitPriceRange(displayLow, next);
  };

  const sliderMid = dMin + (dMax - dMin) / 2;
  const priceLowThumbZ = displayLow > sliderMid ? 2 : 4;
  const priceHighThumbZ = displayLow > sliderMid ? 4 : 2;

  useEffect(() => {
    let filtered = [...products];

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) => selectedBrands.includes(product.vendor || ''));
    }

    if (minPrice || maxPrice) {
      filtered = filtered.filter((product) => {
        const price = parseFloat(product.priceRange?.minVariantPrice?.amount || 0);
        const min = minPrice ? parseFloat(minPrice) : 0;
        const max = maxPrice ? parseFloat(maxPrice) : Infinity;
        return price >= min && price <= max;
      });
    }

    if (selectedMaterials.length > 0) {
      filtered = filtered.filter((product) => {
        const titleLower = (product.title || '').toLowerCase();
        const tagsLower = (product.tags || []).join(' ').toLowerCase();
        const searchText = `${titleLower} ${tagsLower}`;
        return selectedMaterials.some((material) =>
          searchText.includes(material.toLowerCase())
        );
      });
    }

    if (selectedFabrics.length > 0) {
      filtered = filtered.filter((product) => {
        const searchText = productText(product);
        return selectedFabrics.some((fabricName) => {
          const searchTerms = fabricSearchMap[fabricName] || [fabricName.toLowerCase()];
          return searchTerms.some((term) => searchText.includes(term.toLowerCase()));
        });
      });
    }

    if (selectedColors.length > 0) {
      filtered = filtered.filter((product) => {
        const text = productText(product);
        return selectedColors.some((colorLabel) => {
          const opt = COLOR_OPTIONS.find((c) => c.label === colorLabel);
          if (!opt) return false;
          return opt.keywords.some((kw) => text.includes(kw.toLowerCase()));
        });
      });
    }

    filtered.sort((a, b) => {
      const priceA = parseFloat(a.priceRange?.minVariantPrice?.amount || 0);
      const priceB = parseFloat(b.priceRange?.minVariantPrice?.amount || 0);

      switch (sortBy) {
        case 'price-low':
          return priceA - priceB;
        case 'price-high':
          return priceB - priceA;
        case 'name-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'name-desc':
          return (b.title || '').localeCompare(a.title || '');
        case 'featured':
        default:
          return 0;
      }
    });

    onFilterChange(filtered);
  }, [
    products,
    sortBy,
    selectedBrands,
    minPrice,
    maxPrice,
    selectedMaterials,
    selectedFabrics,
    selectedColors,
    fabricSearchMap,
    onFilterChange,
  ]);

  const handleBrandToggle = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const handleMaterialToggle = (material) => {
    setSelectedMaterials((prev) =>
      prev.includes(material) ? prev.filter((m) => m !== material) : [...prev, material]
    );
  };

  const handleFabricToggle = (fabric) => {
    setSelectedFabrics((prev) =>
      prev.includes(fabric) ? prev.filter((f) => f !== fabric) : [...prev, fabric]
    );
  };

  const handleColorToggle = (label) => {
    setSelectedColors((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
  };

  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Sort';

  const priceLabel =
    minPrice || maxPrice
      ? `Price ${minPrice ? `$${minPrice}` : '—'}–${maxPrice ? `$${maxPrice}` : '—'}`
      : 'Price';

  const pillClass = (active) =>
    ['collection-filter-pill', active ? 'collection-filter-pill--active' : '']
      .filter(Boolean)
      .join(' ');

  const activeFilterCount = activeFiltersList.length;

  const handleClearAllMobile = () => {
    setSelectedBrands([]);
    setMinPrice('');
    setMaxPrice('');
    setSelectedMaterials([]);
    setSelectedFabrics([]);
    setSelectedColors([]);
    closeMenu();
    closeMobileFilters();
  };

  const pricePanel = pricePanelUnavailable ? (
    <p className="collection-filter-price-empty">
      No products match your current filters.
    </p>
  ) : (
    <div className="collection-filter-price-panel">
      <div className="collection-price-dual-slider">
        <div className="collection-price-dual-slider-inner">
          <div className="collection-price-dual-slider-track" aria-hidden />
          <div
            className="collection-price-dual-slider-active"
            style={{
              left: `${pctLow}%`,
              width: `${Math.max(0, pctHigh - pctLow)}%`,
            }}
            aria-hidden
          />
          <input
            type="range"
            className="collection-price-dual-slider-input collection-price-dual-slider-input--low"
            style={{ zIndex: priceLowThumbZ }}
            min={dMin}
            max={dMax}
            step={priceStep}
            value={displayLow}
            onChange={(e) => handlePriceSliderLow(e.target.value)}
            aria-label="Minimum price"
          />
          <input
            type="range"
            className="collection-price-dual-slider-input collection-price-dual-slider-input--high"
            style={{ zIndex: priceHighThumbZ }}
            min={dMin}
            max={dMax}
            step={priceStep}
            value={displayHigh}
            onChange={(e) => handlePriceSliderHigh(e.target.value)}
            aria-label="Maximum price"
          />
        </div>
      </div>
      <div className="collection-filter-price-boxes">
        <label className="collection-filter-price-box">
          <span className="collection-filter-price-box-label">Minimum</span>
          <input
            type="number"
            className="collection-filter-price-box-input"
            min={dMin}
            max={displayHigh}
            step={priceStep}
            value={minPrice === '' ? displayLow : minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={() => {
              const s = String(minPrice).trim();
              if (s === '') {
                setMinPrice('');
                return;
              }
              const raw = parseFloat(s.replace(/,/g, ''));
              if (!Number.isFinite(raw)) {
                setMinPrice('');
                return;
              }
              const c = Math.max(dMin, Math.min(displayHigh - priceStep, raw));
              commitPriceRange(c, displayHigh);
            }}
          />
        </label>
        <span className="collection-filter-price-box-sep" aria-hidden>
          -
        </span>
        <label className="collection-filter-price-box">
          <span className="collection-filter-price-box-label">Maximum</span>
          <input
            type="number"
            className="collection-filter-price-box-input"
            min={displayLow}
            max={dMax}
            step={priceStep}
            value={maxPrice === '' ? displayHigh : maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={() => {
              const s = String(maxPrice).trim();
              if (s === '') {
                setMaxPrice('');
                return;
              }
              const raw = parseFloat(s.replace(/,/g, ''));
              if (!Number.isFinite(raw)) {
                setMaxPrice('');
                return;
              }
              const c = Math.min(dMax, Math.max(displayLow + priceStep, raw));
              commitPriceRange(displayLow, c);
            }}
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="collection-filter-bar" ref={barRef}>
      <div className="collection-filter-mobile-bar">
        <button
          type="button"
          className="collection-filter-mobile-trigger"
          onClick={openMobileFilters}
          aria-expanded={mobileFiltersOpen}
          aria-haspopup="dialog"
        >
          <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
          <span>Filters</span>
          {activeFilterCount > 0 ? (
            <span className="collection-filter-mobile-trigger-badge" aria-label={`${activeFilterCount} active filters`}>
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <div className="collection-filter-mobile-sort">
          <div className="collection-filter-pill-wrap collection-filter-pill-wrap--sort">
            <button
              type="button"
              className={pillClass(sortBy !== 'featured')}
              aria-expanded={openMenu === 'sort'}
              onClick={() => toggleMenu('sort')}
            >
              Sort
              <ChevronIcon open={openMenu === 'sort'} />
            </button>
            {openMenu === 'sort' && (
              <div className="collection-filter-dropdown collection-filter-dropdown--sort">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`collection-filter-sort-option ${sortBy === value ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSortBy(value);
                      closeMenu();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="collection-filter-item-count collection-filter-item-count--mobile" aria-live="polite">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      {mobileFiltersOpen ? (
        <div
          className="collection-filter-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-filter-sheet-title"
        >
          <button
            type="button"
            className="collection-filter-sheet-backdrop"
            onClick={closeMobileFilters}
            aria-label="Close filters"
          />
          <div className="collection-filter-sheet-panel">
            <header className="collection-filter-sheet-header">
              <h2 id="collection-filter-sheet-title">Filters</h2>
              <button
                type="button"
                className="collection-filter-sheet-close reset"
                onClick={closeMobileFilters}
                aria-label="Close filters"
              >
                ×
              </button>
            </header>
            <div className="collection-filter-sheet-scroll">
              <MobileFilterSection
                title="Brand"
                active={selectedBrands.length > 0}
                open={mobileSection === 'brand'}
                onToggle={() => toggleMobileSection('brand')}
              >
                {brandOptions.map(({ name, count }) => (
                  <label key={name} className="collection-filter-dropdown-row">
                    <span
                      className="collection-filter-swatch collection-filter-swatch--neutral"
                      aria-hidden
                    />
                    <span className="collection-filter-dropdown-label">{name}</span>
                    <span className="collection-filter-dropdown-count">{count}</span>
                    <input
                      type="checkbox"
                      className="collection-filter-dropdown-check"
                      checked={selectedBrands.includes(name)}
                      onChange={() => handleBrandToggle(name)}
                    />
                  </label>
                ))}
              </MobileFilterSection>

              {materials.length > 0 ? (
                <MobileFilterSection
                  title="Material"
                  active={selectedMaterials.length > 0}
                  open={mobileSection === 'material'}
                  onToggle={() => toggleMobileSection('material')}
                >
                  {materialOptions.map(({ name, count }) => (
                    <label key={name} className="collection-filter-dropdown-row">
                      <span
                        className="collection-filter-swatch collection-filter-swatch--neutral"
                        aria-hidden
                      />
                      <span className="collection-filter-dropdown-label">{name}</span>
                      <span className="collection-filter-dropdown-count">{count}</span>
                      <input
                        type="checkbox"
                        className="collection-filter-dropdown-check"
                        checked={selectedMaterials.includes(name)}
                        onChange={() => handleMaterialToggle(name)}
                      />
                    </label>
                  ))}
                </MobileFilterSection>
              ) : null}

              <MobileFilterSection
                title="Color"
                active={selectedColors.length > 0}
                open={mobileSection === 'color'}
                onToggle={() => toggleMobileSection('color')}
              >
                {colorOptions.map(({ label, hex, count }) => (
                  <label
                    key={label}
                    className={`collection-filter-dropdown-row ${count === 0 ? 'is-disabled' : ''}`}
                  >
                    <span
                      className="collection-filter-swatch"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                    <span className="collection-filter-dropdown-label">{label}</span>
                    <span className="collection-filter-dropdown-count">{count}</span>
                    <input
                      type="checkbox"
                      className="collection-filter-dropdown-check"
                      checked={selectedColors.includes(label)}
                      disabled={count === 0}
                      onChange={() => handleColorToggle(label)}
                    />
                  </label>
                ))}
              </MobileFilterSection>

              <MobileFilterSection
                title="Fabric"
                active={selectedFabrics.length > 0}
                open={mobileSection === 'fabric'}
                onToggle={() => toggleMobileSection('fabric')}
              >
                {fabrics.map(({ name, count }) => (
                  <label
                    key={name}
                    className={`collection-filter-dropdown-row ${count === 0 ? 'is-disabled' : ''}`}
                  >
                    <span
                      className="collection-filter-swatch collection-filter-swatch--neutral"
                      aria-hidden
                    />
                    <span className="collection-filter-dropdown-label">{name}</span>
                    <span className="collection-filter-dropdown-count">{count}</span>
                    <input
                      type="checkbox"
                      className="collection-filter-dropdown-check"
                      checked={selectedFabrics.includes(name)}
                      disabled={count === 0}
                      onChange={() => handleFabricToggle(name)}
                    />
                  </label>
                ))}
              </MobileFilterSection>

              <MobileFilterSection
                title="Price"
                active={Boolean(minPrice || maxPrice)}
                open={mobileSection === 'price'}
                onToggle={() => toggleMobileSection('price')}
              >
                <div className="collection-filter-sheet-price">{pricePanel}</div>
              </MobileFilterSection>
            </div>
            <footer className="collection-filter-sheet-footer">
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="collection-filter-sheet-clear"
                  onClick={handleClearAllMobile}
                >
                  Clear all
                </button>
              ) : null}
              <button
                type="button"
                className="collection-filter-sheet-apply solid-button solid-button--compact"
                onClick={closeMobileFilters}
              >
                View {itemCount} item{itemCount !== 1 ? 's' : ''}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <div className="collection-filter-bar-inner collection-filter-bar-inner--desktop">
        <div className="collection-filter-bar-pills" role="toolbar" aria-label="Filter products">
          {/* Brand */}
          <div className="collection-filter-pill-wrap">
            <button
              type="button"
              className={pillClass(selectedBrands.length > 0)}
              aria-expanded={openMenu === 'brand'}
              aria-haspopup="true"
              onClick={() => toggleMenu('brand')}
            >
              Brand
              <ChevronIcon open={openMenu === 'brand'} />
            </button>
            {openMenu === 'brand' && (
              <div className="collection-filter-dropdown" role="listbox">
                {brandOptions.map(({ name, count }) => (
                  <label key={name} className="collection-filter-dropdown-row">
                    <span
                      className="collection-filter-swatch collection-filter-swatch--neutral"
                      aria-hidden
                    />
                    <span className="collection-filter-dropdown-label">{name}</span>
                    <span className="collection-filter-dropdown-count">{count}</span>
                    <input
                      type="checkbox"
                      className="collection-filter-dropdown-check"
                      checked={selectedBrands.includes(name)}
                      onChange={() => handleBrandToggle(name)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Material */}
          {materials.length > 0 && (
            <div className="collection-filter-pill-wrap">
              <button
                type="button"
                className={pillClass(selectedMaterials.length > 0)}
                aria-expanded={openMenu === 'material'}
                onClick={() => toggleMenu('material')}
              >
                Material
                <ChevronIcon open={openMenu === 'material'} />
              </button>
              {openMenu === 'material' && (
                <div className="collection-filter-dropdown">
                  {materialOptions.map(({ name, count }) => (
                    <label key={name} className="collection-filter-dropdown-row">
                      <span
                        className="collection-filter-swatch collection-filter-swatch--neutral"
                        aria-hidden
                      />
                      <span className="collection-filter-dropdown-label">{name}</span>
                      <span className="collection-filter-dropdown-count">{count}</span>
                      <input
                        type="checkbox"
                        className="collection-filter-dropdown-check"
                        checked={selectedMaterials.includes(name)}
                        onChange={() => handleMaterialToggle(name)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Color */}
          <div className="collection-filter-pill-wrap">
            <button
              type="button"
              className={pillClass(selectedColors.length > 0)}
              aria-expanded={openMenu === 'color'}
              onClick={() => toggleMenu('color')}
            >
              Color
              <ChevronIcon open={openMenu === 'color'} />
            </button>
            {openMenu === 'color' && (
              <div className="collection-filter-dropdown">
                {colorOptions.map(({ label, hex, count }) => (
                  <label
                    key={label}
                    className={`collection-filter-dropdown-row ${count === 0 ? 'is-disabled' : ''}`}
                  >
                    <span
                      className="collection-filter-swatch"
                      style={{ backgroundColor: hex }}
                      aria-hidden
                    />
                    <span className="collection-filter-dropdown-label">{label}</span>
                    <span className="collection-filter-dropdown-count">{count}</span>
                    <input
                      type="checkbox"
                      className="collection-filter-dropdown-check"
                      checked={selectedColors.includes(label)}
                      disabled={count === 0}
                      onChange={() => handleColorToggle(label)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Fabric */}
          <div className="collection-filter-pill-wrap">
            <button
              type="button"
              className={pillClass(selectedFabrics.length > 0)}
              aria-expanded={openMenu === 'fabric'}
              onClick={() => toggleMenu('fabric')}
            >
              Fabric
              <ChevronIcon open={openMenu === 'fabric'} />
            </button>
            {openMenu === 'fabric' && (
              <div className="collection-filter-dropdown collection-filter-dropdown--wide">
                {fabrics.map(({ name, count }) => (
                  <label
                    key={name}
                    className={`collection-filter-dropdown-row ${count === 0 ? 'is-disabled' : ''}`}
                  >
                    <span
                      className="collection-filter-swatch collection-filter-swatch--neutral"
                      aria-hidden
                    />
                    <span className="collection-filter-dropdown-label">{name}</span>
                    <span className="collection-filter-dropdown-count">{count}</span>
                    <input
                      type="checkbox"
                      className="collection-filter-dropdown-check"
                      checked={selectedFabrics.includes(name)}
                      disabled={count === 0}
                      onChange={() => handleFabricToggle(name)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Price */}
          <div className="collection-filter-pill-wrap">
            <button
              type="button"
              className={pillClass(Boolean(minPrice || maxPrice))}
              aria-expanded={openMenu === 'price'}
              onClick={() => toggleMenu('price')}
            >
              {priceLabel}
              <ChevronIcon open={openMenu === 'price'} />
            </button>
            {openMenu === 'price' && (
              <div className="collection-filter-dropdown collection-filter-dropdown--price">
                {pricePanel}
              </div>
            )}
          </div>
        </div>

        <div className="collection-filter-bar-trail">
          <div className="collection-filter-pill-wrap collection-filter-pill-wrap--sort">
            <button
              type="button"
              className={pillClass(sortBy !== 'featured')}
              aria-expanded={openMenu === 'sort'}
              onClick={() => toggleMenu('sort')}
            >
              Sort: {sortLabel}
              <ChevronIcon open={openMenu === 'sort'} />
            </button>
            {openMenu === 'sort' && (
              <div className="collection-filter-dropdown collection-filter-dropdown--sort">
                {SORT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`collection-filter-sort-option ${sortBy === value ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSortBy(value);
                      closeMenu();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="collection-filter-item-count" aria-live="polite">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
});
