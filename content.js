console.log('[OWN.AI v2] Ativo em:', location.hostname);

const SOURCE = location.hostname.includes('99app') ? '99food' : 'ifood';
const seen = new Set();

// Intercepta XHR
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
  this._url = url;
  return origOpen.apply(this, arguments);
};

const origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(body) {
  this.addEventListener('load', function() {
    try {
      if (this.responseText && isOrderEndpoint(this._url)) {
        parseAndSave(this.responseText, SOURCE);
      }
    } catch(e) {}
  });
  return origSend.apply(this, arguments);
};

// Intercepta fetch
const origFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await origFetch.apply(this, args);
  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (isOrderEndpoint(url)) {
      const clone = res.clone();
      clone.text().then(text => parseAndSave(text, SOURCE));
    }
  } catch(e) {}
  return res;
};

function isOrderEndpoint(url) {
  if (!url) return false;
  return url.includes('/order') ||
         url.includes('/pedido') ||
         url.includes('/v3/orders') ||
         url.includes('/delivery') ||
         url.includes('/merchant/') ||
         url.includes('/timeline') ||
         url.includes('/consumer') ||
         url.includes('/customer') ||
         url.includes('/buyer');
}

function parseAndSave(text, source) {
  try {
    const data = JSON.parse(text);
    extractOrders(data, source);
  } catch(e) {}
}

function extractOrders(data, source) {
  if (Array.isArray(data)) {
    data.forEach(item => extractOrders(item, source));
    return;
  }
  if (typeof data !== 'object' || !data) return;

  // Busca telefone em todos os campos possiveis (iFood + 99Food)
  const hasPhone =
    data.customer?.phone ||
    data.customer?.phoneNumber ||
    data.customer?.telephone ||
    data.customer?.celular ||
    data.customer?.mobile ||
    data.phoneNumber ||
    data.phone ||
    data.telephone ||
    data.contact?.phone ||
    data.contact?.phoneNumber ||
    data.buyer?.phone ||
    data.buyer?.phoneNumber ||
    data.user?.phone ||
    data.user?.phoneNumber ||
    data.consumer?.phone ||
    data.consumer?.phoneNumber ||
    data.deliveryAddress?.contactPhone;

  const hasAmount =
    data.totalPrice ||
    data.total ||
    data.amount ||
    data.subTotal ||
    data.orderAmount ||
    data.grandTotal ||
    data.totalValue;

  if (hasPhone && hasAmount) {
    const phone = String(hasPhone).replace(/\D/g, '');
    const amount = parseFloat(String(hasAmount).replace(',', '.'));
    const orderId = data.id || data.orderId || data.order_id ||
                    data.referenceId || data.externalId ||
                    `${source}_${phone}_${Date.now()}`;

    if (seen.has(String(orderId))) return;
    seen.add(String(orderId));

    const items = extractItems(data);
    const name =
      data.customer?.name ||
      data.customer?.fullName ||
      data.buyer?.name ||
      data.buyer?.fullName ||
      data.user?.name ||
      data.consumer?.name ||
      data.deliveryAddress?.contactName ||
      data.customerName ||
      'Cliente ' + source.toUpperCase();

    const order = {
      order_id: String(orderId),
      customer_name: name,
      customer_phone: phone,
      amount: amount,
      order_items: items,
      source: source
    };

    console.log('[OWN.AI v2] Pedido detectado:', order);
    chrome.runtime.sendMessage({ type: 'SAVE_ORDER', data: order });
  } else if (hasAmount && !hasPhone) {
    // Log para debug quando tem valor mas nao tem telefone
    const orderId = data.id || data.orderId;
    if (orderId && !seen.has('debug_' + orderId)) {
      seen.add('debug_' + orderId);
      console.log('[OWN.AI v2] Pedido sem telefone - campos disponiveis:', Object.keys(data));
    }
  }

  // Busca recursiva
  Object.values(data).forEach(val => {
    if (typeof val === 'object' && val !== null) {
      extractOrders(val, source);
    }
  });
}

function extractItems(data) {
  try {
    const items = data.items || data.orderItems || data.products ||
                  data.cart?.items || data.lineItems || [];
    if (!Array.isArray(items) || items.length === 0) return 'Item nao identificado';
    return items.map(i => {
      const qty = i.quantity || i.qty || 1;
      const name = i.name || i.productName || i.description || i.title || 'Item';
      return `${qty}x ${name}`;
    }).join(', ');
  } catch(e) {
    return 'Item nao identificado';
  }
}
