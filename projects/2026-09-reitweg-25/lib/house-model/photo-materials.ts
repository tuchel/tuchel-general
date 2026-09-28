import * as T from 'three';
import {photoSurfaces,type TextureStatus} from './photo-sources';

export function photoMaterials(materials:T.MeshStandardMaterial[],invalidate:()=>void,status:(value:TextureStatus)=>void){
 const loader=new T.TextureLoader(),cache=new Map<string,T.Texture>();let started=false,active=false,disposed=false;
 const blank=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);blank.needsUpdate=true;
 const entries=Object.entries(photoSurfaces).map(([name,source])=>{
  const corners=source.quad.map(([x,y])=>new T.Vector2(x/source.size[0],1-y/source.size[1]));
  return {name,source,ready:false,uniforms:{uSurfacePhoto:{value:blank as T.Texture},uPhotoAmount:{value:0},uPhotoA:{value:corners[0]},uPhotoB:{value:corners[1]},uPhotoC:{value:corners[2]},uPhotoD:{value:corners[3]},uPhotoMetres:{value:new T.Vector2(...source.metres)},uPhotoAxis:{value:source.axis},uPhotoBump:{value:source.bump},uPhotoStone:{value:name==='stone'?1:0},uPhotoMean:{value:new T.Color().setRGB(...({deck:[.48,.46,.42],cladding:[.44,.29,.16],roof:[.365,.375,.415],oak:[.56,.45,.34],stone:[.73,.76,.8],lawn:[.52,.58,.3],linen:[.46,.38,.28],foliage:[.32,.37,.17]}[name] as [number,number,number]),T.SRGBColorSpace)},uPhotoContrast:{value:name==='lawn'?.45:name==='foliage'?.35:name==='oak'?.45:name==='linen'?.35:.85}}};
 });
 for(const mat of materials){const entry=entries.find(e=>e.name===mat.userData.photo);if(!entry)continue;
  mat.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,entry.uniforms);
   shader.vertexShader='varying vec3 vSurfaceWorld; varying vec3 vSurfaceNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 surfacePosition=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     surfacePosition=instanceMatrix*surfacePosition;
    #endif
    vSurfaceWorld=(modelMatrix*surfacePosition).xyz;
    vec3 surfaceNormal=objectNormal;
    #ifdef USE_INSTANCING
     surfaceNormal=mat3(instanceMatrix)*surfaceNormal;
    #endif
    vSurfaceNormal=normalize(mat3(modelMatrix)*surfaceNormal);
   `);
   shader.fragmentShader=`uniform sampler2D uSurfacePhoto;
    uniform float uPhotoAmount; uniform float uPhotoAxis; uniform float uPhotoBump; uniform float uPhotoStone;
    uniform vec3 uPhotoMean; uniform float uPhotoContrast;
    uniform vec2 uPhotoA; uniform vec2 uPhotoB; uniform vec2 uPhotoC; uniform vec2 uPhotoD; uniform vec2 uPhotoMetres;
    varying vec3 vSurfaceWorld; varying vec3 vSurfaceNormal;
    vec2 surfaceUV(){
     vec3 n=abs(normalize(vSurfaceNormal));
     vec2 plane=n.y>max(n.x,n.z)?vSurfaceWorld.xz:n.x>n.z?vec2(vSurfaceWorld.z,vSurfaceWorld.y):vSurfaceWorld.xy;
     if(uPhotoAxis>0.5){vec3 ridge=normalize(cross(vec3(0.0,1.0,0.0),vSurfaceNormal)+vec3(0.00001));vec3 slope=normalize(cross(vSurfaceNormal,ridge));plane=vec2(dot(vSurfaceWorld,ridge),dot(vSurfaceWorld,slope));}
     return plane/uPhotoMetres;
    }
    vec4 readSurface(vec2 uv){
     vec2 f=1.0-abs(mod(uv,2.0)-1.0);
     return texture2D(uSurfacePhoto,mix(mix(uPhotoD,uPhotoC,f.x),mix(uPhotoA,uPhotoB,f.x),f.y));
    }
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float surfaceHeight=0.0;
    if(uPhotoAmount>0.0){
    vec2 surfaceTileUV=surfaceUV();
    vec3 surfaceColour=readSurface(surfaceTileUV).rgb;
    surfaceHeight=dot(surfaceColour,vec3(0.2126,0.7152,0.0722));
    if(uPhotoStone>0.5){vec2 tileEdge=min(fract(surfaceTileUV),1.0-fract(surfaceTileUV));float grout=1.0-smoothstep(0.0015,0.004,min(tileEdge.x,tileEdge.y));surfaceColour=mix(surfaceColour,surfaceColour*.58,grout*.65);}
    vec3 calibratedSurface=diffuseColor.rgb*mix(vec3(1.0),clamp(surfaceColour/max(uPhotoMean,vec3(.001)),vec3(.45),vec3(1.75)),uPhotoContrast);
    diffuseColor.rgb=mix(diffuseColor.rgb,calibratedSurface,uPhotoAmount);
    }
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    if(uPhotoAmount>0.0){
    vec3 surfaceQ0=dFdx(-vViewPosition),surfaceQ1=dFdy(-vViewPosition);
    vec3 surfaceR0=cross(surfaceQ1,normal),surfaceR1=cross(normal,surfaceQ0);
    float surfaceDet=dot(surfaceQ0,surfaceR0);
    vec3 surfaceGradient=sign(surfaceDet)*(dFdx(surfaceHeight)*surfaceR0+dFdy(surfaceHeight)*surfaceR1);
    normal=normalize(abs(surfaceDet)*normal-uPhotoAmount*uPhotoBump*surfaceGradient);
    }
   `);
  };
  mat.customProgramCacheKey=()=>`photo-surface-v1-${entry.name}`;
 }
 const sync=()=>{entries.forEach(e=>{e.uniforms.uPhotoAmount.value=active&&e.ready?1:0;});invalidate();};
 async function load(){status('loading');const results=await Promise.allSettled([...new Set(entries.map(e=>e.source.file))].map(async file=>{const tex=await loader.loadAsync('/assets/'+file);if(disposed){tex.dispose();return;}tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;cache.set(file,tex);for(const entry of entries.filter(e=>e.source.file===file)){entry.uniforms.uSurfacePhoto.value=tex;entry.ready=true;}sync();}));if(!disposed)status(results.every(r=>r.status==='fulfilled')?'ready':'partial');}
 return {setActive:(value:boolean)=>{active=value;sync();if(value&&!started){started=true;void load();}},dispose:()=>{disposed=true;blank.dispose();cache.forEach(t=>t.dispose());}};
}
