function parseUserAgent(uaString = '') {
  const ua = uaString.toLowerCase();
  
  // OS Detection
  let os = 'Unknown OS';
  if (ua.includes('windows nt 10.0')) os = 'Windows 10/11';
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (ua.includes('windows nt 6.2')) os = 'Windows 8';
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('iphone')) os = 'iOS (iPhone)';
  else if (ua.includes('ipad')) os = 'iPadOS';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  // Device Type
  let device = 'Desktop';
  if (/mobile|iphone|ipod|android.*mobile|blackberry|phone/i.test(ua)) {
    device = ua.includes('iphone') ? 'iPhone' : ua.includes('android') ? 'Android Mobile' : 'Mobile Phone';
  } else if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    device = ua.includes('ipad') ? 'iPad' : 'Tablet';
  } else if (os.startsWith('Windows')) {
    device = 'Windows PC';
  } else if (os.startsWith('macOS')) {
    device = 'Mac Desktop';
  } else if (os === 'Linux') {
    device = 'Linux PC';
  }

  // Browser Detection
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) {
    const v = uaString.match(/Edg\/([\d.]+)/);
    browser = `Edge ${v ? v[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
    const v = uaString.match(/Chrome\/([\d.]+)/);
    browser = `Chrome ${v ? v[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    const v = uaString.match(/Version\/([\d.]+)/);
    browser = `Safari ${v ? v[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('firefox/')) {
    const v = uaString.match(/Firefox\/([\d.]+)/);
    browser = `Firefox ${v ? v[1].split('.')[0] : ''}`.trim();
  } else if (ua.includes('opr/') || ua.includes('opera/')) {
    browser = 'Opera';
  }

  return { device, browser, os };
}

function getClientIp(req) {
  let ip = req.headers['cf-connecting-ip'] ||
           req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '127.0.0.1';

  if (typeof ip === 'string' && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

module.exports = { parseUserAgent, getClientIp };
