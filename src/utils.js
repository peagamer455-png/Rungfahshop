// src/utils.js

// ฟังก์ชันจัดรูปแบบเงิน (เช่น 1,250.00 ฿)
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2
  }).format(amount);
};

// ฟังก์ชันจัดรูปแบบวันที่และเวลาจากฐานข้อมูล (เช่น 25/10/2568 14:30)
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' ' + date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ฟังก์ชันแสดงวันที่ปัจจุบันแบบเต็ม (เช่น วันศุกร์ที่ 25 ตุลาคม 2568)
export const formatThaiDate = () => {
  const date = new Date();
  return date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// 1. ฟังก์ชันคำนวณกำไร (ใช้บ่อยในหน้า Dashboard และ POS)
export const calculateProfit = (price, cost) => {
  return Number(price) - Number(cost);
};

// 2. ฟังก์ชันตรวจสอบว่าค่าที่รับมาเป็นตัวเลขที่ใช้งานได้จริงหรือไม่ (กันค่า NaN)
export const parseNumber = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// 3. ฟังก์ชันสร้าง ID ไม่ซ้ำ (ใช้ตอนสร้างบิลใหม่หรือเพิ่มสินค้าใหม่)
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 4. ฟังก์ชันสำหรับจัดการข้อความ Barcode (อันนี้สำคัญมาก เพราะคุณมีโค้ดนี้ใน App)
export const translateBarcode = (text) => {
  if (!text) return '';
  const map = {
    'ๅ': '1', '/': '2', '-': '3', 'ภ': '4', 'ถ': '5', 'ุ': '6', 'ึ': '7', 'ค': '8', 'ต': '9', 'จ': '0',
    'ข': '-', 'ช': '=', '+': '1', '๑': '2', '๒': '3', '๓': '4', '๔': '5', 'ู': '6', '฿': '7', '๕': '8', '๖': '9', '๗': '0',
  };
  return [...text].map(c => map[c] || c).join('')
    .replace(/[^A-Za-z0-9-]/g, '')
    .trim()
    .toLowerCase();
};

export const PRODUCT_STORE = 'products';

export const putData = async (tableName, data) => {
  try {
    const { data: result, error } = await supabase
      .from(tableName)
      .upsert(data)
      .select()
      .single();

    if (error) throw error;
    return result.id; // ส่งกลับ ID ของรายการที่บันทึก
  } catch (error) {
    console.error(`Error in putData (${tableName}):`, error);
    throw error;
  }
};

export const deleteData = async (tableName, id) => {
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error in deleteData (${tableName}):`, error);
    throw error;
  }
};

export const displayMaybeMasked = (val, isCost) => {
  // หากคุณมีระบบซ่อนราคาทุน ใส่ Logic ที่นี่ ถ้าไม่มีให้แสดงค่าปกติ
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2 });
};

export const revertStock = async (supabase, billItems) => {
    for (const item of billItems) {
        const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.productId)
            .single();

        if (product) {
            await supabase
                .from('products')
                .update({ stock: product.stock + item.qty })
                .eq('id', item.productId);
        }
    }
};