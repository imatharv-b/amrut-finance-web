import html2canvas from 'html2canvas';

export const printHTML = (html) => {
  return new Promise((resolve, reject) => {
    try {
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
