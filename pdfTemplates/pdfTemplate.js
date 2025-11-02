import { jsPDF } from 'jspdf';

interface InvoiceData {
  invoiceNumber: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  service: string;
  date: string;
  time: string;
  vehicleType: string;
  licensePlate: string;
  price: string;
  bookingDate: string;
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF();
  
  // Colors
  const yellow = [255, 215, 0];
  const black = [10, 10, 10];
  const gray = [31, 31, 31];
  const lightGray = [180, 180, 180];
  const white = [255, 255, 255];
  
  // Page setup
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  
  // Background gradient effect (using rectangles)
  doc.setFillColor(black[0], black[1], black[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Header background with yellow gradient
  doc.setFillColor(yellow[0], yellow[1], yellow[2]);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  // Racing stripes pattern
  doc.setFillColor(0, 0, 0, 0.1);
  for (let i = 0; i < pageWidth; i += 20) {
    doc.rect(i, 0, 10, 60, 'F');
  }
  
  // Logo and Company Name
  doc.setTextColor(black[0], black[1], black[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('RACING CLEAN', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Excellence & Performance', pageWidth / 2, 40, { align: 'center' });
  
  // Invoice title
  doc.setFillColor(gray[0], gray[1], gray[2]);
  doc.rect(0, 60, pageWidth, 30, 'F');
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', margin, 80);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.text(`N° ${data.invoiceNumber}`, pageWidth - margin, 75, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, 82, { align: 'right' });
  
  // Yellow divider line
  doc.setDrawColor(yellow[0], yellow[1], yellow[2]);
  doc.setLineWidth(2);
  doc.line(margin, 95, pageWidth - margin, 95);
  
  // Client Information Box
  let yPos = 110;
  
  doc.setFillColor(gray[0], gray[1], gray[2]);
  doc.roundedRect(margin, yPos, (pageWidth - 2 * margin) / 2 - 5, 40, 3, 3, 'F');
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT', margin + 5, yPos + 10);
  
  doc.setTextColor(white[0], white[1], white[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.userName, margin + 5, yPos + 20);
  doc.text(data.userEmail, margin + 5, yPos + 27);
  doc.text(data.userPhone, margin + 5, yPos + 34);
  
  // Service Information Box
  doc.setFillColor(gray[0], gray[1], gray[2]);
  doc.roundedRect(pageWidth / 2 + 5, yPos, (pageWidth - 2 * margin) / 2 - 5, 40, 3, 3, 'F');
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('VÉHICULE', pageWidth / 2 + 10, yPos + 10);
  
  doc.setTextColor(white[0], white[1], white[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Type: ${data.vehicleType}`, pageWidth / 2 + 10, yPos + 20);
  doc.text(`Plaque: ${data.licensePlate}`, pageWidth / 2 + 10, yPos + 27);
  doc.text(`Réservé le: ${data.bookingDate}`, pageWidth / 2 + 10, yPos + 34);
  
  // Service Details Section
  yPos = 165;
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DÉTAILS DU SERVICE', margin, yPos);
  
  // Yellow line under section title
  doc.setDrawColor(yellow[0], yellow[1], yellow[2]);
  doc.setLineWidth(1);
  doc.line(margin, yPos + 3, pageWidth - margin, yPos + 3);
  
  yPos += 15;
  
  // Table header
  doc.setFillColor(gray[0], gray[1], gray[2]);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F');
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESTATION', margin + 5, yPos + 8);
  doc.text('DATE & HEURE', pageWidth / 2, yPos + 8);
  doc.text('MONTANT', pageWidth - margin - 35, yPos + 8);
  
  // Table content
  yPos += 12;
  doc.setFillColor(black[0], black[1], black[2]);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 20, 'F');
  
  // Yellow border for table
  doc.setDrawColor(yellow[0], yellow[1], yellow[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos - 12, pageWidth - 2 * margin, 32);
  
  doc.setTextColor(white[0], white[1], white[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.service, margin + 5, yPos + 7);
  doc.text(`${data.date}`, pageWidth / 2, yPos + 7);
  doc.text(`${data.time}`, pageWidth / 2, yPos + 14);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(12);
  doc.text(data.price, pageWidth - margin - 35, yPos + 10);
  
  // Total section with highlight
  yPos += 40;
  
  doc.setFillColor(yellow[0], yellow[1], yellow[2]);
  doc.roundedRect(pageWidth - margin - 70, yPos, 70, 25, 3, 3, 'F');
  
  // Racing stripe pattern on total box
  doc.setFillColor(0, 0, 0, 0.1);
  for (let i = 0; i < 70; i += 10) {
    doc.rect(pageWidth - margin - 70 + i, yPos, 5, 25, 'F');
  }
  
  doc.setTextColor(black[0], black[1], black[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL TTC', pageWidth - margin - 65, yPos + 10);
  
  doc.setFontSize(16);
  doc.text(data.price, pageWidth - margin - 65, yPos + 20);
  
  // Footer information
  yPos = pageHeight - 60;
  
  // Yellow divider line
  doc.setDrawColor(yellow[0], yellow[1], yellow[2]);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 10;
  
  doc.setFillColor(gray[0], gray[1], gray[2]);
  doc.rect(0, yPos - 5, pageWidth, 60, 'F');
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RACING CLEAN', pageWidth / 2, yPos + 5, { align: 'center' });
  
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Excellence en nettoyage automobile depuis 2020', pageWidth / 2, yPos + 12, { align: 'center' });
  doc.text('Siège social: 123 Avenue de la Performance, 75000 Paris', pageWidth / 2, yPos + 18, { align: 'center' });
  doc.text('SIRET: 123 456 789 00012 | TVA: FR12345678901', pageWidth / 2, yPos + 24, { align: 'center' });
  
  doc.setTextColor(yellow[0], yellow[1], yellow[2]);
  doc.setFontSize(7);
  doc.text('Merci de votre confiance | www.racingclean.fr', pageWidth / 2, yPos + 35, { align: 'center' });
  
  // Decorative corner elements
  // Top left corner
  doc.setDrawColor(yellow[0], yellow[1], yellow[2]);
  doc.setLineWidth(2);
  doc.line(margin - 5, 65, margin + 10, 65);
  doc.line(margin - 5, 65, margin - 5, 80);
  
  // Bottom right corner
  doc.line(pageWidth - margin + 5, pageHeight - 65, pageWidth - margin - 10, pageHeight - 65);
  doc.line(pageWidth - margin + 5, pageHeight - 65, pageWidth - margin + 5, pageHeight - 80);
  
  // Generate filename
  const fileName = `Facture_RacingClean_${data.invoiceNumber}_${data.userName.replace(/\s+/g, '_')}.pdf`;
  
  // Save the PDF
  doc.save(fileName);
}

// Function to generate invoice number
export function generateInvoiceNumber(bookingId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const uniqueId = bookingId.slice(-6).toUpperCase();
  
  return `RC-${year}${month}${day}-${uniqueId}`;
}
