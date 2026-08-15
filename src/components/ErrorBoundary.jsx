import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Automatically reload the page if it's a chunk load error
    const isChunkError = 
      error?.name === 'ChunkLoadError' || 
      (error?.message && error.message.includes('dynamically imported module')) ||
      (error?.message && error.message.includes('fetch dynamically imported module')) ||
      (error?.message && error.message.includes('Importing a module script failed'));
      
    if (isChunkError) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden liquid-bg">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center border border-rose-200/50 shadow-xl shadow-rose-900/5 relative z-10">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Oops, something went wrong!</h2>
            <p className="text-sm text-slate-600 mb-6 font-medium">
              {this.state.error?.message || 'An unexpected error occurred while loading the application.'}
            </p>
            <p className="text-[10px] text-slate-400 mb-6 uppercase tracking-wider font-bold">Try reloading the page to get the latest version</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
