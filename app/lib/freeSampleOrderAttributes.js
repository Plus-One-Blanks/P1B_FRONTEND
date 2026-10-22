/**
 * Cart / order line attributes for the Free Sample offer.
 */

export const FREE_SAMPLE_ATTR = {
  flag: '_freeSample',
  item: 'Sample item',
  placement: 'Sample placement',
  printSize: 'Sample print size',
  artwork: 'Sample artwork',
  artworkUrl: '_sampleArtworkUrl',
  sheetId: '_sampleSheetId',
  offer: '_sampleOffer',
  fileName: '_sampleFileName',
};

/**
 * @param {string} s
 */
function truncateAttr(s) {
  const str = String(s || '');
  return str.length > 250 ? `${str.slice(0, 247)}...` : str;
}

/**
 * @param {{
 *   sampleItem: string;
 *   placementLabel?: string | null;
 *   printSizeLabel?: string | null;
 *   artworkLabel?: string | null;
 *   artworkUrl?: string | null;
 *   sheetId?: string | null;
 *   offerId?: string | null;
 *   fileName?: string | null;
 * }} opts
 * @returns {Array<{ key: string; value: string }>}
 */
export function buildFreeSampleLineAttributes(opts) {
  /** @type {Array<{ key: string; value: string }>} */
  const attrs = [
    {key: FREE_SAMPLE_ATTR.flag, value: '1'},
    {
      key: FREE_SAMPLE_ATTR.item,
      value: truncateAttr(opts.sampleItem || 'Custom artwork transfer'),
    },
  ];

  if (opts.placementLabel) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.placement,
      value: truncateAttr(opts.placementLabel),
    });
  }
  if (opts.printSizeLabel) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.printSize,
      value: truncateAttr(opts.printSizeLabel),
    });
  }
  if (opts.artworkLabel) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.artwork,
      value: truncateAttr(opts.artworkLabel),
    });
  }
  if (opts.artworkUrl && !String(opts.artworkUrl).startsWith('data:')) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.artworkUrl,
      value: truncateAttr(opts.artworkUrl),
    });
  }
  if (opts.sheetId) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.sheetId,
      value: truncateAttr(opts.sheetId),
    });
  }
  if (opts.offerId) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.offer,
      value: truncateAttr(opts.offerId),
    });
  }
  if (opts.fileName) {
    attrs.push({
      key: FREE_SAMPLE_ATTR.fileName,
      value: truncateAttr(opts.fileName),
    });
  }

  return attrs;
}

/**
 * @param {Array<{ key?: string | null; value?: string | null }> | null | undefined} attributes
 */
export function readFreeSampleFromLineAttributes(attributes) {
  if (!attributes?.length) return null;
  const map = Object.fromEntries(
    attributes.filter((a) => a?.key).map((a) => [a.key, a.value]),
  );
  if (!map[FREE_SAMPLE_ATTR.flag] && !map[FREE_SAMPLE_ATTR.item]) return null;
  return {
    sampleItem: map[FREE_SAMPLE_ATTR.item] || null,
    placement: map[FREE_SAMPLE_ATTR.placement] || null,
    printSize: map[FREE_SAMPLE_ATTR.printSize] || null,
    artwork: map[FREE_SAMPLE_ATTR.artwork] || null,
    artworkUrl: map[FREE_SAMPLE_ATTR.artworkUrl] || null,
    sheetId: map[FREE_SAMPLE_ATTR.sheetId] || null,
    offerId: map[FREE_SAMPLE_ATTR.offer] || null,
    fileName: map[FREE_SAMPLE_ATTR.fileName] || null,
  };
}
