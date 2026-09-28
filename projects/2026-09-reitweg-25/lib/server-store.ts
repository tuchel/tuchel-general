import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export async function isStudioOwner(){const user=await getChatGPTUser();const email=env.STUDIO_OWNER_EMAIL;return !!user&&!!email&&user.email.toLowerCase()===email.toLowerCase();}
export async function owner(){const user=await getChatGPTUser();if(!user)throw new Error("AUTH_REQUIRED");if(!await isStudioOwner())throw new Error("OWNER_REQUIRED");return user.userId;}
export function db(){if(!env.DB)throw new Error("STORE_UNAVAILABLE");return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error("STORE_UNAVAILABLE");return env.BUCKET;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)throw new Error('ORIGIN_REJECTED');}
export function failure(error:unknown){const message=error instanceof Error?error.message:"Unknown error";console.error("Design studio request failed:",message);return Response.json({error:message==="AUTH_REQUIRED"?"Sign in to access your design studio.":message==="OWNER_REQUIRED"?"Only the studio owner can access saved work.":message==="ORIGIN_REJECTED"?"This request is not allowed.":"Your studio could not be reached. Your text has been kept; please try again."},{status:message==="AUTH_REQUIRED"?401:message==="ORIGIN_REJECTED"||message==="OWNER_REQUIRED"?403:503});}
export function unpack(row:Record<string,unknown>){return {...row,content:JSON.parse(String(row.content))};}
