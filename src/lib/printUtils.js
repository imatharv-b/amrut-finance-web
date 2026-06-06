export const printHTML = (html) => {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups to enable printing.');
      }
      printWindow.document.write(html);
      printWindow.document.close();
      
      printWindow.onload = () => {
        printWindow.focus();
        // Use setTimeout to ensure rendering is complete before the print dialog
        setTimeout(() => {
          printWindow.print();
          resolve();
        }, 250);
      };
    } catch (err) {
      reject(err);
    }
  });
};
