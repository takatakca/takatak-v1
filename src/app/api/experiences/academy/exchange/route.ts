import { authorizeAcademyExchange, exchangeAcademyExperienceLaunch } from "@/lib/experiences/academy-experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request: Request){
  if(!authorizeAcademyExchange(request))return jsonResponse({ok:false,message:"Forbidden."},403);
  if(!(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))
    return jsonResponse({ok:false,message:"JSON required."},415);
  const length=Number(request.headers.get("content-length")||"0");
  if(!Number.isFinite(length)||length>2048)
    return jsonResponse({ok:false,message:"Request too large."},413);
  let data:unknown;
  try{data=await request.json()}catch{return jsonResponse({ok:false,message:"Invalid JSON."},400);}
  if(!data||typeof data!=="object"||Array.isArray(data)||typeof (data as Record<string,unknown>).code!=="string")
    return jsonResponse({ok:false,message:"Invalid launch code."},400);
  try{
    const session=await exchangeAcademyExperienceLaunch((data as {code:string}).code);
    const response=jsonResponse({ok:true,session},200);
    response.headers.set("X-Robots-Tag","noindex, nofollow");
    return response;
  }catch(error){return handleApiError("academy-exchange",error,"Academy exchange failed.");}
}
