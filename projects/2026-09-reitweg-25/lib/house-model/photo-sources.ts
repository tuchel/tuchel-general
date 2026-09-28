/** These are sampled surfaces from the owner's photographs, not stock or AI textures.
 * Source coordinates are pixels (top-left origin). Mapping happens in the shader,
 * preserving the source files. Mirrored repetition avoids hard crop seams.
 */
export const photoSurfaces={
 deck:{label:'Weathered pool timber',file:'pool-flush-surround-reference.jpg',size:[768,1024],quad:[[405,849],[416,852],[402,884],[391,880]],metres:[.12,.48],axis:0,bump:.001},
 cladding:{label:'Exterior timber',file:'IMG_1431.jpg',size:[960,1280],quad:[[45,35],[775,18],[778,268],[42,313]],metres:[1.8,.75],axis:0,bump:.006},
 roof:{label:'Roof tiles',file:'IMG_1627.jpg',size:[1280,960],quad:[[1033,464],[1115,473],[1115,493],[1035,486]],metres:[1.6,.8],axis:1,bump:.006},
 oak:{label:'Oak grain',file:'IMG_1462.jpg',size:[1280,960],quad:[[176,860],[270,830],[310,866],[224,918]],metres:[1.5,.65],axis:0,bump:.0015},
 stone:{label:'Stone paving & floors',file:'IMG_1431.jpg',size:[960,1280],quad:[[363,1107],[536,1124],[512,1170],[326,1152]],metres:[.6,.6],axis:0,bump:.0015},
 lawn:{label:'Garden lawn',file:'IMG_1403.jpg',size:[1280,960],quad:[[570,718],[1020,714],[1015,920],[540,919]],metres:[4,3],axis:0,bump:.01},
 linen:{label:'Linen upholstery',file:'IMG_1462.jpg',size:[1280,960],quad:[[290,590],[385,581],[385,596],[290,606]],metres:[.6,.2],axis:0,bump:.001},
 foliage:{label:'Leaf colour & detail',file:'IMG_1388.jpg',size:[960,1280],quad:[[338,325],[535,325],[535,472],[338,472]],metres:[1.1,1.1],axis:0,bump:.004}
} as const;
export type PhotoSurface=keyof typeof photoSurfaces;
export type TextureStatus='idle'|'loading'|'ready'|'partial';
