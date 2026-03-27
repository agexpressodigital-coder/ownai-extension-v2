const SUPABASE_URL = 'https://mmtvjshrapxpeaicbrdn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdHZqc2hyYXB4cGVhaWNicmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDcwOTMsImV4cCI6MjA5MDEyMzA5M30.X3_dhWSiGhKhTZ6Z-uozQMkNftr4m5tOIKzr6mJ_JMs';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_ORDER') {
    saveOrder(msg.data).then(sendResponse);
    return true;
  }
});

async function saveOrder(order) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        order_id: order.order_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        amount: order.amount,
        order_items: order.order_items,
        source: order.source || 'ifood',
        restaurant_id: order.restaurant_id || null
      })
    });
    console.log('[OWN.AI] Salvo:', order.order_id, res.status);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error('[OWN.AI] Erro:', err);
    return { ok: false, error: err.message };
  }
}
