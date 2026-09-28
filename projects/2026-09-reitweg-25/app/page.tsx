import StudioApp from '@/components/studio/app';
import {chatGPTSignInPath} from './chatgpt-auth';
import {isStudioOwner} from '@/lib/server-store';
export const dynamic='force-dynamic';
export default async function Page(){return <StudioApp canEdit={await isStudioOwner()} signInHref={chatGPTSignInPath('/')}/>;}
