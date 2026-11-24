import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

/** Short shadows where things touch (Extreme): a chair leg on the terrace, a pot on its paving, a sill on its wall. The
 * sun's shadow map cannot hold them (a texel is 2 cm at best and biased off the surface), so each pixel that faces the
 * light looks `reach` m toward it through the frame's own depth, and darkens where something nearer the light stands in
 * the way within `thick` m. Jittered per frame; the still image averages it smooth. `strength`: how dark a full contact
 * is; `far`: metres from the camera at which it has faded out, a contact there being finer than a pixel. */
export const CONTACT={reach:.5,steps:10,thick:.3,strength:.5,far:45,low:[.02,.14] as const};

export class ContactShadows extends Pass{
 private material:T.ShaderMaterial;private quad:FullScreenQuad;private toLight=new T.Vector3();private frame=0;
 constructor(private camera:T.PerspectiveCamera,private light:T.DirectionalLight,depth:T.Texture){
  super();
  this.material=new T.ShaderMaterial({
   uniforms:{frame:{value:null},depth:{value:depth},toLight:{value:new T.Vector3()},lens:{value:new T.Vector2()},amount:{value:0},seed:{value:0},far:{value:1000}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D frame;uniform sampler2D depth;uniform vec3 toLight;uniform vec2 lens;uniform float amount;uniform float seed;uniform float far;varying vec2 vUv;
    float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}
    vec3 at(vec2 uv,float d){return vec3((uv*2.0-1.0)*lens*d,-d);}
    void main(){
     vec4 colour=texture2D(frame,vUv);float d=texture2D(depth,vUv).r;
     if(amount<=0.0||d>=${CONTACT.far.toFixed(1)}||d>=far*0.999){gl_FragColor=colour;return;}
     vec3 p=at(vUv,d),n=normalize(cross(dFdx(p),dFdy(p)));
     float facing=dot(n,toLight);
     if(facing<=0.04){gl_FragColor=colour;return;}
     float bias=max(0.015,d*0.004),jitter=fract(ign(gl_FragCoord.xy)+seed*0.618034),shade=0.0;
     p+=n*bias;
     for(int i=0;i<${CONTACT.steps};i++){
      float t=${CONTACT.reach.toFixed(2)}*(float(i)+jitter)/${CONTACT.steps}.0;
      vec3 q=p+toLight*(bias+t);if(q.z>-0.05)break;
      vec2 uv=q.xy/(-q.z*lens)*0.5+0.5;if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))break;
      float gap=-q.z-texture2D(depth,uv).r;
      if(gap>bias&&gap<${CONTACT.thick.toFixed(2)}){shade=1.0-t/${CONTACT.reach.toFixed(2)}*0.6;break;}
     }
     shade*=amount*smoothstep(0.04,0.25,facing)*(1.0-smoothstep(${(CONTACT.far*.6).toFixed(1)},${CONTACT.far.toFixed(1)},d));
     gl_FragColor=vec4(colour.rgb*(1.0-shade),colour.a);
    }`,depthTest:false,depthWrite:false});
  this.quad=new FullScreenQuad(this.material);
 }
 render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const u=this.material.uniforms,light=this.light,tan=Math.tan(T.MathUtils.degToRad(this.camera.fov)/2);
  this.toLight.subVectors(light.position,light.target.position).normalize();
  // None by night or with the light at the horizon, where a half-metre march says nothing about a shadow metres long.
  u.amount.value=light.intensity>0?CONTACT.strength*T.MathUtils.smoothstep(this.toLight.y,...CONTACT.low):0;
  (u.toLight.value as T.Vector3).copy(this.toLight).transformDirection(this.camera.matrixWorldInverse);
  (u.lens.value as T.Vector2).set(tan*this.camera.aspect,tan);u.far.value=this.camera.far;u.seed.value=this.frame=(this.frame+1)%64;u.frame.value=read.texture;
  renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
 }
 dispose(){this.material.dispose();this.quad.dispose();}
}
