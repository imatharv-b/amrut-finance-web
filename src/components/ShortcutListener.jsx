import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ShortcutListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey) {
        switch (e.key) {
          case 'F5':
            e.preventDefault();
            navigate('/expenses/new');
            break;
          case 'F6':
            e.preventDefault();
            navigate('/payments/record');
            break;
          case 'F7':
            e.preventDefault();
            navigate('/purchases/new');
            break;
          case 'F8':
            e.preventDefault();
            navigate('/sales/new');
            break;
          case 'l':
          case 'L':
            e.preventDefault();
            navigate('/payments/ledger');
            break;
          default:
            break;
        }
      } else if (e.key === 'Escape') {
        // Only navigate home on Escape if there's no modal currently open
        const hasModal = document.querySelector('.fixed.inset-0.z-50');
        if (!hasModal) {
          navigate('/');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return null;
}
