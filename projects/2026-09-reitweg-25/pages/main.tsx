import {createRoot} from 'react-dom/client';
import HouseModel from '../components/studio/model/house-model';
import '../app/globals.css';

// Pages is the public site: the full-screen 3D model and nothing else. The design studio, with its other pages and the
// owner's records, stays on Sites (components/studio/app.tsx).
createRoot(document.getElementById('root')!).render(
 <div style={{'--sidebar-width':'0px'} as React.CSSProperties}><HouseModel/></div>
);
