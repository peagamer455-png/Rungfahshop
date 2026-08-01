import { formatCurrency, formatDate } from '../utils';
import html2pdf from 'html2pdf.js';

// ฟังก์ชันช่วยหาตำแหน่งกึ่งกลางหน้าจอ
const getCenteredWindow = (w, h) => {
    const y = window.top.outerHeight / 2 + window.top.screenY - (h / 2);
    const x = window.top.outerWidth / 2 + window.top.screenX - (w / 2);
    return `width=${w},height=${h},top=${y},left=${x}`;
};

// 1. พิมพ์แบบใบเสร็จ (Thermal)
const printReceipt = (billData) => {
    const discount = parseFloat(billData.discount) || 0;
    const totalBeforeDiscount = parseFloat(billData.subTotal) || billData.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalAfterDiscount = billData.total_net || (billData.subTotal - billData.discount);
    const displayDiscount = discount;
    const rawBillNo = billData.bill_number || billData.billNumber || billData.bill_no || billData.no || billData.id || "000";
    const cleanBillNo = String(rawBillNo).replace(/[^\x20-\x7Eก-ฮะ-์]/g, '').trim();
    const fileIdentifier = cleanBillNo !== "000" ? cleanBillNo : "000";
    const totalDiscount = totalBeforeDiscount - billData.totalsale;
    const vatInfo = billData.payment_details?.vatEnabled ? billData.payment_details : null;

    const receiptContent = `
    <div style="font-family: 'Tahoma', sans-serif; width: 72mm; font-size: 12px; color: #000; padding: 5px;">
        <h2 style="text-align: center; margin: 0 0 5px 0; font-size: 16px;">ร้าน รุ่งฟ้าแอร์</h2>
        <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">
            141 ม.4 ต.บ้านกลาง อ.เมือง จ.ปทุมธานี<br>
            โทร: 085-168-9671
        </div>
        <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <span>เลขที่: ${fileIdentifier}</span>
            <span>${formatDate(billData.date)}</span>
        </div>
        <div style="font-size: 10px; margin-bottom: 5px;">
            ลูกค้า: ${billData.customer || 'ทั่วไป'}
            ${billData.customer_detail ? `<br>ข้อมูลเพิ่มเติม: ${billData.customer_detail}` : ''}
        </div>
        
        <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 5px;">
            <thead>
                <tr style="border-bottom: 1px solid #000;">
                    <th style="text-align: left; padding: 2px 0;">รายการ</th>
                    <th style="text-align: center; padding: 2px 0;">จำนวน</th>
                    <th style="text-align: right; padding: 2px 0;">ราคา</th>
                    <th style="text-align: right; padding: 2px 0;">รวม</th>
                </tr>
            </thead>
            <tbody>
                ${billData.items.map(item => `
                    <tr>
                        <td style="padding: 3px 0;">${item.name}</td>
                        <td style="text-align: center; padding: 3px 0;">${item.qty}</td>
                        <td style="text-align: right; padding: 3px 0;">${formatCurrency(item.price)}</td>
                        <td style="text-align: right; padding: 3px 0;">${formatCurrency(item.price * item.qty)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div style="border-top: 1px solid #000; margin: 5px 0;"></div>
        
        <div style="text-align: right; font-size: 11px;">
            <div style="margin-bottom: 2px;">ยอดรวมสินค้า: ${formatCurrency(totalBeforeDiscount)}</div>
            ${displayDiscount > 0 ? `<div style="color: #000; margin-bottom: 2px;">ส่วนลด: -${formatCurrency(discount)}</div>` : ''}
            ${vatInfo ? `<div style="margin-bottom: 2px;">+VAT 7%: +${formatCurrency(vatInfo.vatAmount || 0)}</div>` : ''}
            <div style="font-weight: bold; font-size: 14px; margin-top: 5px;">ยอดสุทธิ: ${formatCurrency(totalAfterDiscount)}</div>
        </div>
        
        <div style="text-align: center; margin-top: 15px; font-size: 10px;">ขอบคุณที่ใช้บริการ</div>
    </div>
`;

    const features = getCenteredWindow(300, 500);
    const printWindow = window.open('', '_blank', features);
    printWindow.document.write(`
        <html>
            <head>
                <style>
                    @media print {
                        @page { margin: 0; width: 80mm; }
                        body { margin: 0; padding: 5px; }
                    }
                </style>
            </head>
            <body>${receiptContent}</body>
        </html>
    `);
    printWindow.document.close();

    // หน่วงเวลาเล็กน้อยเพื่อให้ CSS โหลดเสร็จก่อนสั่งพิมพ์
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};


const printA4 = (billData) => {
    const discount = parseFloat(billData.discount) || 0;
    const totalBeforeDiscount = parseFloat(billData.subTotal) || billData.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalAfterDiscount = billData.total_net || (billData.subTotal - billData.discount);
    const displayDiscount = discount;
    const rawBillNo = billData.bill_number || billData.billNumber || billData.bill_no || billData.no || billData.id || "000";
    const cleanBillNo = String(rawBillNo).replace(/[^\x20-\x7Eก-ฮะ-์]/g, '').trim();
    const fileIdentifier = cleanBillNo !== "000" ? cleanBillNo : "000";
    const vatInfo = billData.payment_details?.vatEnabled ? billData.payment_details : null;

    const content = `
        <div style="font-family: 'Noto Serif Thai', sans-serif; width: 100%; box-sizing: border-box; background: #fff; padding: 10px;">
            <h1 style="text-align: center; color: #166534; font-size: 16px; margin: 5px 0;">ใบเสร็จรับเงิน</h1>
            
            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 12px;">
                <div>
                    <p style="margin: 2px 0;">ร้าน รุ่งฟ้าแอร์</p>
                    <p style="margin: 2px 0;">141 ม.4 ต.บ้านกลาง อ.เมือง จ.ปทุมธานี</p>
                    <p style="margin: 2px 0;">โทร: 085-168-9671</p>
                    <div style="margin-top: 2px;">
                        <p style="margin: 2px 0;">ลูกค้า: ${billData.customer || 'ไม่ระบุ'}</p>
                        ${billData.customer_detail ? `<p style="margin: 0;">ข้อมูลเพิ่มเติม: ${billData.customer_detail}</p>` : ''}
                    </div>
                </div>
                <div style="text-align: right; font-size: 12px;">
                    <p style="margin: 2px 0;">วันที่: ${formatDate(billData.date)}</p>
                    <p style="margin: 2px 0;">เลขที่: ${fileIdentifier}</p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px;">
                <thead>
                    <tr style="color: black;">
                        <th style="padding: 6px 2px; text-align: center; border: 0.5px solid #333;">ลำดับ</th>
                        <th style="padding: 6px 2px; text-align: center; border: 0.5px solid #333;">รายการ</th>
                        <th style="padding: 6px 2px; text-align: center; border: 0.5px solid #333;">ราคา</th>
                        <th style="padding: 6px 2px; text-align: center; border: 0.5px solid #333;">จำนวน</th>
                        <th style="padding: 6px 2px; text-align: center; border: 0.5px solid #333;">รวม</th>
                    </tr>
                </thead>
                <tbody>
                    ${billData.items.map((item, i) => `
                        <tr style="border-bottom: 0.5px solid #ddd;">
                            <td style="padding: 6px 2px; text-align: center; border: 0.5px solid #ddd; vertical-align: middle;">${i + 1}</td>
                            <td style="padding: 6px 4px; text-align: left; border: 0.5px solid #ddd; vertical-align: middle;">${item.name}</td>
                            <td style="padding: 6px 2px; text-align: right; border: 0.5px solid #ddd; vertical-align: middle;">${formatCurrency(item.price)}</td>
                            <td style="padding: 6px 2px; text-align: center; border: 0.5px solid #ddd; vertical-align: middle;">${item.qty}</td>
                            <td style="padding: 6px 2px; text-align: right; border: 0.5px solid #ddd; vertical-align: middle;">${formatCurrency(item.price * item.qty)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 10px; font-size: 12px; display: flex; flex-direction: column; align-items: flex-end;">
                <div style="width: 250px; display: flex; justify-content: space-between;">
                    <span>ยอดรวมสินค้า:</span>
                    <span>${formatCurrency(totalBeforeDiscount)}</span>
                </div>
                ${displayDiscount > 0 ? `<div style="color: #000; margin-bottom: 2px;">ส่วนลด: -${formatCurrency(discount)}</div>` : ''}
                ${vatInfo ? `
                <div style="width: 250px; display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>+VAT 7%:</span>
                    <span>+${formatCurrency(vatInfo.vatAmount || 0)}</span>
                </div>` : ''}
                <div style="width: 250px; display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px solid #333; margin-top: 5px; padding-top: 5px;">
                    <span>ยอดจ่ายสุทธิ:</span>
                    <span>${formatCurrency(totalAfterDiscount)}</span>
                </div>
            </div>

            <div style="text-align: right; margin-top: 30px; font-size: 12px;">
                <p style="margin: 5px 0;">........................</p>
                <p style="margin: 0;">ผู้รับเงิน</p>
            </div>
    
            <div style="text-align: center; margin-top: 20px; font-size: 12px;">
                <p>ขอบคุณที่ใช้บริการ</p>
            </div>
        </div>
    `;

    // เปิดหน้าต่างใหม่
    const features = getCenteredWindow(600, 800);
    const printWindow = window.open('', '_blank', features);
    printWindow.document.write(`
        <html>
            <head>
                <style>
                    @media print {
                        @page { size: A5; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>${content}</body>
        </html>
    `);
    printWindow.document.close();

    // สั่งพิมพ์
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

export const handlePrint = (billData) => {
    const type = billData.print_size || 'a4';
    type === 'receipt' ? printReceipt(billData) : printA4(billData);
};
