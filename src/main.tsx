import { createRoot } from 'react-dom/client';
import { App } from './App';
import { demoAdapter } from './adapters';
import './style.css';
createRoot(document.getElementById('root')!).render(<App adapter={demoAdapter()} />);
