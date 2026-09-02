import{r as v}from"./index-DfQT3DIj.js";function b(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}var a=v();const S=b(a);/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=(...e)=>e.filter((t,o,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===o).join(" ").trim();/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(t,o,r)=>r?r.toUpperCase():o.toLowerCase());/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=e=>{const t=L(e);return t.charAt(0).toUpperCase()+t.slice(1)};/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var i={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=e=>{for(const t in e)if(t.startsWith("aria-")||t==="role"||t==="title")return!0;return!1},W=a.createContext({}),M=()=>a.useContext(W),R=a.forwardRef(({color:e,size:t,strokeWidth:o,absoluteStrokeWidth:r,className:s="",children:c,iconNode:y,...u},C)=>{const{size:n=24,strokeWidth:d=2,absoluteStrokeWidth:f=!1,color:k="currentColor",className:x=""}=M()??{},m=r??f?Number(o??d)*24/Number(t??n):o??d;return a.createElement("svg",{ref:C,...i,width:t??n??i.width,height:t??n??i.height,stroke:e??k,strokeWidth:m,className:p("lucide",x,s),...!c&&!_(u)&&{"aria-hidden":"true"},...u},[...y.map(([w,g])=>a.createElement(w,g)),...Array.isArray(c)?c:[c]])});/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=(e,t)=>{const o=a.forwardRef(({className:r,...s},c)=>a.createElement(R,{ref:c,iconNode:t,className:p(`lucide-${A(h(e))}`,`lucide-${e}`,r),...s}));return o.displayName=h(e),o};/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],q=l("circle-alert",$);/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],O=l("copy",j);/**
 * @license lucide-react v1.39.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],P=l("refresh-cw",E);export{O as C,P as R,q as a,S as b,l as c,a as r};
