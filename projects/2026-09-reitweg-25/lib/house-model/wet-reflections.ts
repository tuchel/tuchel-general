import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {wet} from './surface-materials';

/** Wet ground mirrors the scene (Extreme, while it rains and until the paving has dried). The paving's shader leaves in
 * the frame's alpha how far each pixel mirrors: standing water wholly, the film between puddles partly
 * (surface-materials.ts). Each such pixel of level ground follows its mirrored view ray through the frame's own depth,
 * `steps` samples out to `reach` m, and shows what it meets in place of the sky's reflection: lit windows, posts,
 * trees, or the sky itself. What is off screen cannot be mirrored; there the sky's reflection stays. */
export const WET_MIRROR={steps:56,reach:60};

export class WetReflections extends Pass{
 private material:T.ShaderMaterial;private quad:FullScreenQuad;private frame=0;
 constructor(private camera:T.PerspectiveCamera,depth:T.Texture){
  super();
  this.material=new T.ShaderMaterial({
   uniforms:{frame:{value:null},depth:{value:depth},lens:{value:new T.Vector2()},amount:wet,seed:{value:0},far:{value:1000},camWorld:{value:new T.Matrix4()}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D frame;uniform sampler2D depth;uniform vec2 lens;uniform float amount;uniform float seed;uniform float far;uniform mat4 camWorld;varying vec2 vUv;
    float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
    float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
    vec3 at(vec2 uv,float d){return vec3((uv*2.0-1.0)*lens*d,-d);}
    void main(){
     vec4 colour=texture2D(frame,vUv);float d=texture2D(depth,vUv).r;gl_FragColor=vec4(colour.rgb,1.0);
     if(amount<=0.0||d>=far*0.999)return;
     vec3 p=at(vUv,d),n=normalize(cross(dFdx(p),dFdy(p)));
     float mirror=clamp((1.0-colour.a)*2.0,0.0,1.0);
     // Leaf edges, anti-aliased by coverage, also leave alpha below one, down to nothing: only the paving's half counts.
     if(mirror<0.02||colour.a<0.49)return;
     mat3 toWorld=mat3(camWorld);vec3 nw=toWorld*n;
     if(nw.y<0.9)return;
     vec3 c=colour.rgb,pw=(camWorld*vec4(p,1.0)).xyz;
     float pool=smoothstep(0.5,1.0,mirror),m=mirror;
     // The film between puddles follows the paving's grain; standing water lies flat.
     vec2 e=vec2(0.03,0.0);vec3 rough=vec3(noise(pw.xz*9.0+e.xy)-noise(pw.xz*9.0-e.xy),0.0,noise(pw.xz*9.0+e.yx)-noise(pw.xz*9.0-e.yx))*(1.0-pool)*0.25;
     vec3 up=normalize(vec3(0.0,1.0,0.0)+rough),nv=normalize(transpose(toWorld)*up),v=normalize(p),r=reflect(v,nv);
     float fresnel=0.03+0.97*pow(1.0-max(dot(-v,nv),0.0),5.0);
     float jitter=fract(ign(gl_FragCoord.xy)+seed*0.618034),last=0.0,t=0.0;vec3 hit=vec3(0.0);float found=0.0;
     for(int i=0;i<${WET_MIRROR.steps};i++){
      float k=(float(i)+jitter)/${WET_MIRROR.steps}.0;t=${WET_MIRROR.reach.toFixed(1)}*k*k+0.05;
      vec3 q=p+r*t;if(q.z>-0.1)break;
      vec2 uv=q.xy/(-q.z*lens)*0.5+0.5;if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))break;
      float s=texture2D(depth,uv).r,gap=-q.z-s;
      if(s>=far*0.999){if(i==${WET_MIRROR.steps-1}||-q.z>400.0){hit=texture2D(frame,uv).rgb;found=1.0;break;}}
      else if(gap>0.0&&gap<max(0.6,(t-last)*1.5)){
       float a=last,b=t;
       for(int j=0;j<5;j++){float mid=(a+b)*0.5;vec3 h=p+r*mid;vec2 hu=h.xy/(-h.z*lens)*0.5+0.5;if(-h.z-texture2D(depth,hu).r>0.0)b=mid;else a=mid;}
       vec3 h=p+r*b;uv=h.xy/(-h.z*lens)*0.5+0.5;hit=texture2D(frame,uv).rgb;
       vec2 edge=smoothstep(vec2(0.0),vec2(0.06),uv)*(1.0-smoothstep(vec2(0.94),vec2(1.0),uv));found=edge.x*edge.y;break;
      }
      last=t;
     }
     float w=m*found*clamp(fresnel*2.4+0.12,0.0,0.94);
     gl_FragColor=vec4(c*(1.0-w)+hit*w,1.0);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const u=this.material.uniforms,tan=Math.tan(T.MathUtils.degToRad(this.camera.fov)/2);
  (u.lens.value as T.Vector2).set(tan*this.camera.aspect,tan);u.far.value=this.camera.far;u.seed.value=this.frame=(this.frame+1)%64;u.frame.value=read.texture;
  (u.camWorld.value as T.Matrix4).copy(this.camera.matrixWorld);
  renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
 }
 /** Runs only while something is wet. */
 get wet(){return wet.value>0;}
 dispose(){this.material.dispose();this.quad.dispose();}
}
