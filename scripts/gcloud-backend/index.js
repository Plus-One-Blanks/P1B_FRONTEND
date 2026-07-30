/**
 * Single entry for local Functions Framework / one Cloud Run service.
 * Routes:
 *   POST /removeBackground
 *   POST /saveDesign
 *   GET  /getDesign?id=
 *   GET  /admin/design?id=
 */

const removeBackground = require('./removeBackground');
const saveDesign = require('./saveDesign');
const getDesign = require('./getDesign');
const adminDesign = require('./adminDesign');

exports.api = async (req, res) => {
  const path = String(req.path || req.url || '/')
    .split('?')[0]
    .replace(/\/+$/, '')
    .replace(/^\//, '');

  if (path === 'removeBackground' || path.endsWith('/removeBackground')) {
    return removeBackground(req, res);
  }
  if (path === 'saveDesign' || path.endsWith('/saveDesign')) {
    return saveDesign(req, res);
  }
  if (path === 'getDesign' || path.endsWith('/getDesign')) {
    return getDesign(req, res);
  }
  if (
    path === 'admin/design' ||
    path.endsWith('/admin/design') ||
    path === 'adminDesign' ||
    path.endsWith('/adminDesign')
  ) {
    return adminDesign(req, res);
  }

  res.status(404).json({
    error: 'Unknown route',
    routes: [
      '/removeBackground',
      '/saveDesign',
      '/getDesign',
      '/admin/design',
    ],
  });
};

exports.removeBackground = removeBackground;
exports.saveDesign = saveDesign;
exports.getDesign = getDesign;
exports.adminDesign = adminDesign;
