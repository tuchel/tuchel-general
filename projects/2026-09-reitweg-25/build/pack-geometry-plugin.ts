import type {Plugin} from 'vite';

/** The file of three-mesh-bvh that packs a scene's vertex attributes for the WebGPU path tracer. */
export const PACK_FILE='three-mesh-bvh/src/webgpu/utils/packBVHBufferUtils.js';
const ANCHOR='\t\tbvhData.getDefaultAttributeValue( name, _def );\n';
// Ordinary float attributes are copied number by number; the library's own loop (a Vector4 read and written per
// vertex) still takes everything else: skinned meshes, interleaved, normalized or integer attributes, missing ones.
const PLAIN=`
		if ( attr && ! mesh && attr.isBufferAttribute && ! attr.normalized && attr.array instanceof Float32Array ) {

			const array = attr.array, size = attr.itemSize, rest = [ _def.x, _def.y, _def.z, _def.w ];
			for ( let i = 0; i < vertexCount; i ++ ) {

				const to = ( writeOffset + i ) * attrStructLength + interleavedOffset * 4, from = ( i + vertexStart ) * size;
				for ( let k = 0; k < 4; k ++ ) attributesBufferF32[ to + k ] = k < size ? array[ from + k ] : rest[ k ];

			}

			return;

		}
`;
/** The moving ray trace takes its scene on the page's thread, where that packing was most of a 2.4 s freeze (M3 Max,
 * 2.5 M vertices). Fails the build if the library no longer has the place this goes. */
export function packGeometry(){
 return {name:'pack-geometry',enforce:'pre' as const,transform(code:string,id:string){
  if(!id.split('?')[0].endsWith(PACK_FILE))return;
  if(code.split(ANCHOR).length!==2)throw new Error('pack-geometry: '+PACK_FILE+' has changed');
  return {code:code.replace(ANCHOR,ANCHOR+PLAIN),map:null};
 }} satisfies Plugin;
}
