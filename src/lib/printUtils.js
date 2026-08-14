import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const printHTML = (html, filename) => {
  return new Promise((resolve, reject) => {
    try {
      const originalTitle = document.title;
      if (filename) {
        document.title = filename;
      }
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();

      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          if (filename) {
            document.title = originalTitle;
          }
          resolve();
        }, 1000);
      };
    } catch (err) {
      reject(err);
    }
  });
};

export const exportAsJPG = (html, filename = 'document.jpg') => {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '200vw';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1200px';
      iframe.style.border = '0';
      iframe.style.backgroundColor = 'white';
      document.body.appendChild(iframe);

      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();

      setTimeout(() => {
        const body = iframe.contentWindow.document.body;
        html2canvas(body, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 800,
          windowHeight: 1200
        }).then(canvas => {
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          
          const link = document.createElement('a');
          link.href = imgData;
          link.download = filename;
          link.click();
          
          document.body.removeChild(iframe);
          resolve(imgData);
        }).catch(err => {
          document.body.removeChild(iframe);
          reject(err);
        });
      }, 1500);
    } catch (err) {
      reject(err);
    }
  });
};

export const exportAsPDF = (html, filename = 'document.pdf') => {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '200vw';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      // height will be determined by content, but giving it a large initial height helps render
      iframe.style.height = '2000px';
      iframe.style.border = '0';
      iframe.style.backgroundColor = 'white';
      document.body.appendChild(iframe);

      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();

      setTimeout(() => {
        const body = iframe.contentWindow.document.body;
        html2canvas(body, {
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 800
        }).then(canvas => {
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          // A4 dimensions in pt are 595.28 x 841.89
          const pdf = new jsPDF('p', 'pt', 'a4');
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          // Handle multi-page if height > A4 height
          let heightLeft = pdfHeight;
          let position = 0;
          const pageHeight = pdf.internal.pageSize.getHeight();

          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;

          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
          }
          
          pdf.save(filename);

          const blob = pdf.output('blob');
          const file = new File([blob], filename, { type: 'application/pdf' });
          
          document.body.removeChild(iframe);
          resolve({ file, blob });
        }).catch(err => {
          document.body.removeChild(iframe);
          reject(err);
        });
      }, 1500);
    } catch (err) {
      reject(err);
    }
  });
};
