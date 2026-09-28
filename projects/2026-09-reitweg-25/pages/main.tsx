import {createRoot} from 'react-dom/client';
import StudioApp from '../components/studio/app';
import '../app/globals.css';

// Pages is the public, static viewer. Owner records and uploads stay on Sites.
createRoot(document.getElementById('root')!).render(
 <StudioApp canEdit={false} homeHref="/tuchel-general/reitweg-25/" signInHref="https://reitweg-25-design-studio.tuchel.chatgpt.site/signin-with-chatgpt?return_to=%2F"/>
);
