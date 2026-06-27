import { supabase } from './supabaseClient';

// --- Database Operations ---
export const fetchData = async () => {
  const { data, error } = await supabase.from('products').select('*');
  if (error) throw error;
  return data;
};

export const putData = async (product) => {
  const { error } = await supabase.from('products').upsert([product]);
  if (error) throw error;
};

export const deleteData = async (id) => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

// --- Utilities (CSV & Barcode) ---
export const exportProductsCSV = (products) => {
  const BOM = "\uFEFF";
  const header = ['ID', 'ชื่อสินค้า', 'ราคาขาย', 'ราคาทุน', 'สต็อก', 'บาร์โค้ด'];
  const csv = BOM + [header.join(','), ...products.map(p => 
    [p.id, `"${p.name}"`, p.price, p.cost, p.stock, p.barcode].join(',')
  )].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `products_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
};

export const generateBarcode = (product) => {
  if (window.JsBarcode) {
    const canvas = document.createElement('canvas');
    window.JsBarcode(canvas, product.barcode || product.id, { format: "CODE128" });
    const link = document.createElement('a');
    link.href = canvas.toDataURL("image/png");
    link.download = `barcode_${product.name}.png`;
    link.click();
  }
};