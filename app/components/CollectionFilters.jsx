import { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';

/**
 * @typedef {{ type: string; label: string; value: string }} ActiveFilter
 */

/**
 * @param {{
 *   products: Array<any>;
 *   onFilterChange: (filteredProducts: Array<any>) => void;
 *   onActiveFiltersChange?: (filters: ActiveFilter[]) => void;
 * }}
 */
export const CollectionFilters = forwardRef(function CollectionFilters(
  { products, onFilterChange, onActiveFiltersChange },
  ref
) {
  const [sortBy, setSortBy] = useState('featured');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [isBrandExpanded, setIsBrandExpanded] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [isMaterialExpanded, setIsMaterialExpanded] = useState(false);
  const [selectedFabrics, setSelectedFabrics] = useState([]);
  const [isFabricExpanded, setIsFabricExpanded] = useState(false);

  const getActiveFilters = () => {
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
    return filters;
  };

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
        default:
          break;
      }
    },
  }));

  useEffect(() => {
    onActiveFiltersChange?.(getActiveFilters());
  }, [minPrice, maxPrice, selectedBrands, selectedMaterials, selectedFabrics, onActiveFiltersChange]);

  // Extract unique brands from products
  const brands = useMemo(() => {
    const brandSet = new Set();
    products.forEach((product) => {
      if (product.vendor) {
        brandSet.add(product.vendor);
      }
    });
    return Array.from(brandSet).sort();
  }, [products]);

  // Extract unique materials from product titles/tags
  const materials = useMemo(() => {
    const materialSet = new Set();
    const materialKeywords = [
      'cotton', 'polyester', 'poly', 'blend', 'tri-blend', 'cvc',
      'jersey', 'heather', 'organic', 'bamboo', 'modal'
    ];

    products.forEach((product) => {
      const titleLower = (product.title || '').toLowerCase();
      const tagsLower = (product.tags || []).join(' ').toLowerCase();
      const searchText = `${titleLower} ${tagsLower}`;

      materialKeywords.forEach((keyword) => {
        if (searchText.includes(keyword)) {
          // Format the material name nicely
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

  // Extract unique fabrics from product titles/tags with counts
  const fabrics = useMemo(() => {
    const fabricMap = new Map();
    
    // Define all possible fabric types with their search terms
    const allFabricTypes = [
      { 
        name: '100% Cotton',
        searchTerms: ['100% cotton', '100%cotton', 'cotton 100%', 'cotton']
      },
      { 
        name: '100% Polyester',
        searchTerms: ['100% polyester', '100%polyester', 'polyester 100%', 'polyester']
      },
      { 
        name: 'Cotton/Poly Blend',
        searchTerms: ['cotton/poly', 'cotton poly blend', 'cotton/polyester', 'cotton polyester blend', '50/50', '5050', 'cotton poly', 'cvc', '50/50 blend']
      },
      { 
        name: 'Cotton/Spandex',
        searchTerms: ['cotton/spandex', 'cotton spandex', 'cotton spandex blend']
      },
      { 
        name: 'Organic',
        searchTerms: ['organic', 'organic cotton']
      },
      { 
        name: 'Performance',
        searchTerms: ['performance', 'performance fabric', 'athletic']
      },
      { 
        name: 'Polyester Blend',
        searchTerms: ['polyester blend', 'poly blend']
      },
      { 
        name: 'Rayon',
        searchTerms: ['rayon']
      },
      { 
        name: 'Recycled',
        searchTerms: ['recycled', 'recycled fabric']
      },
      { 
        name: 'Spandex',
        searchTerms: ['spandex']
      },
      { 
        name: 'Tri-Blend (Poly/Cotton/Rayon)',
        searchTerms: ['tri-blend', 'tri blend', 'poly/cotton/rayon', 'poly cotton rayon', 'triblend']
      }
    ];
    
    // Count products for each fabric type
    products.forEach((product) => {
      const titleLower = (product.title || '').toLowerCase();
      const tagsArray = product.tags || [];
      const tagsLower = Array.isArray(tagsArray) ? tagsArray.join(' ').toLowerCase() : String(tagsArray).toLowerCase();
      const descriptionLower = (product.description || '').toLowerCase();
      // Combine all searchable text
      const searchText = `${titleLower} ${tagsLower} ${descriptionLower}`;
      
      allFabricTypes.forEach(({ name, searchTerms }) => {
        // Check if any search term is found in the product text
        const matches = searchTerms.some(term => {
          const termLower = term.toLowerCase();
          return searchText.includes(termLower);
        });
        
        if (matches) {
          const currentCount = fabricMap.get(name) || 0;
          fabricMap.set(name, currentCount + 1);
        }
      });
    });
    
    // Always return all fabric types, with count 0 if not found
    return allFabricTypes.map(({ name }) => ({
      name,
      count: fabricMap.get(name) || 0
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Get price range from products
  const priceRange = useMemo(() => {
    const prices = products
      .map((p) => parseFloat(p.priceRange?.minVariantPrice?.amount || 0))
      .filter((p) => p > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...products];

    // Filter by brand
    if (selectedBrands.length > 0) {
      filtered = filtered.filter((product) =>
        selectedBrands.includes(product.vendor || '')
      );
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      filtered = filtered.filter((product) => {
        const price = parseFloat(product.priceRange?.minVariantPrice?.amount || 0);
        const min = minPrice ? parseFloat(minPrice) : 0;
        const max = maxPrice ? parseFloat(maxPrice) : Infinity;
        return price >= min && price <= max;
      });
    }

    // Filter by material
    if (selectedMaterials.length > 0) {
      filtered = filtered.filter((product) => {
        const titleLower = (product.title || '').toLowerCase();
        const tagsLower = (product.tags || []).join(' ').toLowerCase();
        const searchText = `${titleLower} ${tagsLower}`;

        return selectedMaterials.some((material) => {
          const materialLower = material.toLowerCase();
          return searchText.includes(materialLower);
        });
      });
    }

    // Filter by fabric
    if (selectedFabrics.length > 0) {
      const fabricSearchMap = {
        '100% Cotton': ['100% cotton', '100%cotton', 'cotton 100%'],
        '100% Polyester': ['100% polyester', '100%polyester', 'polyester 100%'],
        'Cotton/Poly Blend': ['cotton/poly', 'cotton poly blend', 'cotton/polyester', 'cotton polyester blend', '50/50', '5050', 'cotton poly', 'cvc'],
        'Cotton/Spandex': ['cotton/spandex', 'cotton spandex'],
        'Organic': ['organic'],
        'Performance': ['performance'],
        'Polyester Blend': ['polyester blend', 'poly blend'],
        'Rayon': ['rayon'],
        'Recycled': ['recycled'],
        'Spandex': ['spandex'],
        'Tri-Blend (Poly/Cotton/Rayon)': ['tri-blend', 'tri blend', 'poly/cotton/rayon', 'poly cotton rayon']
      };
      
      filtered = filtered.filter((product) => {
        const titleLower = (product.title || '').toLowerCase();
        const tagsArray = product.tags || [];
        const tagsLower = Array.isArray(tagsArray) ? tagsArray.join(' ').toLowerCase() : String(tagsArray).toLowerCase();
        const descriptionLower = (product.description || '').toLowerCase();
        const searchText = `${titleLower} ${tagsLower} ${descriptionLower}`;
        
        return selectedFabrics.some((fabricName) => {
          const searchTerms = fabricSearchMap[fabricName] || [fabricName.toLowerCase()];
          return searchTerms.some(term => searchText.includes(term.toLowerCase()));
        });
      });
    }

    // Sort products
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
          return 0; // Keep original order
      }
    });

    onFilterChange(filtered);
  }, [products, sortBy, selectedBrands, minPrice, maxPrice, selectedMaterials, selectedFabrics, onFilterChange]);

  const handleBrandToggle = (brand) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((b) => b !== brand)
        : [...prev, brand]
    );
  };

  const handleMaterialToggle = (material) => {
    setSelectedMaterials((prev) =>
      prev.includes(material)
        ? prev.filter((m) => m !== material)
        : [...prev, material]
    );
  };

  const handleFabricToggle = (fabric) => {
    setSelectedFabrics((prev) =>
      prev.includes(fabric)
        ? prev.filter((f) => f !== fabric)
        : [...prev, fabric]
    );
  };

  return (
    <div className="collection-filters">
      {/* Sort By */}
      <div className="collection-filter-section">
        <label className="collection-filter-label">Sort by</label>
        <select
          className="collection-filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="featured">Featured</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="name-asc">Name: A-Z</option>
          <option value="name-desc">Name: Z-A</option>
        </select>
      </div>

      {/* Price Range Filter */}
      <div className="collection-filter-section">
        <label className="collection-filter-label">Price Range</label>
        <div className="collection-filter-price-inputs">
          <input
            type="number"
            className="collection-filter-price-input"
            placeholder={`Min $${priceRange.min}`}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            min={priceRange.min}
            max={priceRange.max}
          />
          <span className="collection-filter-price-separator">-</span>
          <input
            type="number"
            className="collection-filter-price-input"
            placeholder={`Max $${priceRange.max}`}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            min={priceRange.min}
            max={priceRange.max}
          />
        </div>
      </div>

      {/* Brand Filter */}
      <div className="collection-filter-section">
        <button
          className="collection-filter-toggle"
          onClick={() => setIsBrandExpanded(!isBrandExpanded)}
        >
          <span>Brand</span>
          <svg
            className={`collection-filter-chevron ${isBrandExpanded ? 'expanded' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </button>
        {isBrandExpanded && (
          <div className="collection-filter-options">
            {brands.map((brand) => (
              <label key={brand} className="collection-filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => handleBrandToggle(brand)}
                />
                <span>{brand}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Material Filter */}
      {materials.length > 0 && (
        <div className="collection-filter-section">
          <button
            className="collection-filter-toggle"
            onClick={() => setIsMaterialExpanded(!isMaterialExpanded)}
          >
            <span>Material</span>
            <svg
              className={`collection-filter-chevron ${isMaterialExpanded ? 'expanded' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 4.5l3 3 3-3" />
            </svg>
          </button>
          {isMaterialExpanded && (
            <div className="collection-filter-options">
              {materials.map((material) => (
                <label key={material} className="collection-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(material)}
                    onChange={() => handleMaterialToggle(material)}
                  />
                  <span>{material}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fabric Filter */}
      <div className="collection-filter-section">
        <button
          className="collection-filter-toggle"
          onClick={() => setIsFabricExpanded(!isFabricExpanded)}
        >
          <span>Fabric</span>
          <svg
            className={`collection-filter-chevron ${isFabricExpanded ? 'expanded' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </button>
        {isFabricExpanded && (
          <div className="collection-filter-options">
            {fabrics.map(({ name, count }) => (
              <label key={name} className="collection-filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFabrics.includes(name)}
                  onChange={() => handleFabricToggle(name)}
                  disabled={count === 0}
                />
                <span className="collection-filter-checkbox-label">
                  <span style={{ opacity: count === 0 ? 0.5 : 1 }}>{name}</span>
                  <span className="collection-filter-count">({count})</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

