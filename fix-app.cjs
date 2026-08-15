const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace("import LoadingSpinner from './components/LoadingSpinner'", "import LoadingSpinner from './components/LoadingSpinner'\nimport ErrorBoundary from './components/ErrorBoundary'");
code = code.replace("<Suspense fallback={<PageFallback />}>", "<ErrorBoundary>\n                <Suspense fallback={<PageFallback />}>");
code = code.replace("</Suspense>", "</Suspense>\n              </ErrorBoundary>");
fs.writeFileSync('src/App.jsx', code, 'utf8');
