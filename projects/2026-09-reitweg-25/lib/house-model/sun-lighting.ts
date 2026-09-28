import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {sunStudyReading,sunDirection,type SunStudy} from './sun-position';

export function sunLighting(root:T.Object3D,scene:T.Scene,sun:T.DirectionalLight,hemisphere:T.HemisphereLight,renderer:T.WebGLRenderer){
 const sky=new Sky();sky.name='calculated-sun-sky';sky.userData.skipPhotographic=true;sky.scale.setScalar(10000);sky.visible=false;scene.add(sky);
 sky.material.uniforms.turbidity.value=3;sky.material.uniforms.rayleigh.value=1.4;sky.material.uniforms.mieCoefficient.value=.005;sky.material.uniforms.cloudCoverage.value=0;sky.material.uniforms.showSunDisc.value=true;
 const fogColour=scene.fog?.color.clone();
 const center=new T.Vector3(-8,0,9);scene.add(sun.target);
 function mountains(night:number){root.traverse(o=>{if(o instanceof T.Mesh&&o.userData.scenicBackdrop)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshBasicMaterial)m.color.setScalar(.08+.92*night);});}
 return {apply:(study:SunStudy)=>{
  if(!study.enabled){if(scene.fog&&fogColour)scene.fog.color.copy(fogColour);sky.visible=false;sun.target.position.set(0,0,0);sun.target.updateMatrixWorld();sun.shadow.camera.far=180;sun.shadow.camera.updateProjectionMatrix();mountains(1);return;}
  const reading=sunStudyReading(study),alt=reading.elevation,dir=new T.Vector3(...sunDirection(reading.azimuth,reading.apparentElevation));
  sky.visible=true;sky.material.uniforms.sunPosition.value.copy(dir);sun.target.position.copy(center);sun.target.updateMatrixWorld();sun.position.copy(center).addScaledVector(dir,160);sun.shadow.camera.far=300;sun.shadow.camera.updateProjectionMatrix();
  const daylight=T.MathUtils.smoothstep(alt,-6,12),direct=T.MathUtils.smoothstep(alt,-.5,18),warmth=1-T.MathUtils.smoothstep(alt,0,24);
  if(scene.fog&&fogColour)scene.fog.color.copy(fogColour).lerp(new T.Color('#080e18'),1-daylight);
  sun.intensity=alt<-.833?0:3.3*direct;sun.color.set('#fff4de').lerp(new T.Color('#ffaf69'),warmth*.8);
  hemisphere.intensity=.025+daylight*.325;hemisphere.color.set('#839bbf').lerp(new T.Color('#eff6ff'),daylight);
  scene.environmentIntensity=.008+.112*daylight;renderer.toneMappingExposure=.82;mountains(daylight);
  const lights=root.getObjectByName('evening-interior-light');lights?.traverse(o=>{if(o instanceof T.Light)o.intensity=0;});
  renderer.shadowMap.needsUpdate=true;
 },dispose:()=>{sky.geometry.dispose();sky.material.dispose();sky.removeFromParent();}};
}
