import{m as e}from"./Icon-BztG91yP.js";import{t}from"./defineProperty-BbfpZ9Tg.js";import{I as n}from"./index-BHvV40xN.js";var r=Object.defineProperty,i=Object.getOwnPropertyDescriptor,a=Object.getOwnPropertyNames,o=Object.prototype.hasOwnProperty,s=(t=>typeof e<`u`?e:typeof Proxy<`u`?new Proxy(t,{get:(t,n)=>(typeof e<`u`?e:t)[n]}):t)(function(t){if(typeof e<`u`)return e.apply(this,arguments);throw Error(`Dynamic require of "`+t+`" is not supported`)}),c=(e,t)=>()=>(e&&(t=e(e=0)),t),l=(e,t)=>{for(var n in t)r(e,n,{get:t[n],enumerable:!0})},u=(e,t,n,s)=>{if(t&&typeof t==`object`||typeof t==`function`)for(let c of a(t))!o.call(e,c)&&c!==n&&r(e,c,{get:()=>t[c],enumerable:!(s=i(t,c))||s.enumerable});return e},d=e=>u(r({},`__esModule`,{value:!0}),e),f,p,m,h,g,_=c(()=>{f=new Map,p=[],m=(e,t,n)=>{if(t&&typeof t.init==`function`&&typeof t.createInferenceSessionHandler==`function`){let r=f.get(e);if(r===void 0)f.set(e,{backend:t,priority:n});else{if(r.priority>n)return;if(r.priority===n&&r.backend!==t)throw Error(`cannot register backend "${e}" using priority ${n}`)}if(n>=0){let t=p.indexOf(e);t!==-1&&p.splice(t,1);for(let t=0;t<p.length;t++)if(f.get(p[t]).priority<=n){p.splice(t,0,e);return}p.push(e)}return}throw TypeError(`not a valid backend`)},h=async e=>{let t=f.get(e);if(!t)return`backend not found.`;if(t.initialized)return t.backend;if(t.aborted)return t.error;{let n=!!t.initPromise;try{return n||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(e){return n||(t.error=`${e}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},g=async e=>{let t=e.executionProviders||[],n=t.map(e=>typeof e==`string`?e:e.name),r=n.length===0?p:n,i,a=[],o=new Set;for(let e of r){let t=await h(e);typeof t==`string`?a.push({name:e,err:t}):(i||(i=t),i===t&&o.add(e))}if(!i)throw Error(`no available backend found. ERR: ${a.map(e=>`[${e.name}] ${e.err}`).join(`, `)}`);for(let{name:e,err:t}of a)n.includes(e)&&console.warn(`removing requested execution provider "${e}" from session options because it is not available: ${t}`);let s=t.filter(e=>o.has(typeof e==`string`?e:e.name));return[i,new Proxy(e,{get:(e,t)=>t===`executionProviders`?s:Reflect.get(e,t)})]}}),v=c(()=>{_()}),y,b=c(()=>{y=`1.27.0`}),x,S,C=c(()=>{b(),x=`warning`,S={wasm:{},webgl:{},webgpu:{},versions:{common:y},set logLevel(e){if(e!==void 0){if(typeof e!=`string`||[`verbose`,`info`,`warning`,`error`,`fatal`].indexOf(e)===-1)throw Error(`Unsupported logging level: ${e}`);x=e}},get logLevel(){return x}},Object.defineProperty(S,"logLevel",{enumerable:!0})}),w,T=c(()=>{C(),w=S}),ee,E,te=c(()=>{ee=(e,t)=>{let n=typeof document<`u`?document.createElement(`canvas`):new OffscreenCanvas(1,1);n.width=e.dims[3],n.height=e.dims[2];let r=n.getContext(`2d`);if(r!=null){let i,a;(t==null?void 0:t.tensorLayout)!==void 0&&t.tensorLayout===`NHWC`?(i=e.dims[2],a=e.dims[3]):(i=e.dims[3],a=e.dims[2]);let o=(t==null?void 0:t.format)===void 0?`RGB`:t.format,s=t==null?void 0:t.norm,c,l;s===void 0||s.mean===void 0?c=[255,255,255,255]:typeof s.mean==`number`?c=[s.mean,s.mean,s.mean,s.mean]:(c=[s.mean[0],s.mean[1],s.mean[2],0],s.mean[3]!==void 0&&(c[3]=s.mean[3])),s===void 0||s.bias===void 0?l=[0,0,0,0]:typeof s.bias==`number`?l=[s.bias,s.bias,s.bias,s.bias]:(l=[s.bias[0],s.bias[1],s.bias[2],0],s.bias[3]!==void 0&&(l[3]=s.bias[3]));let u=a*i,d=0,f=u,p=u*2,m=-1;o===`RGBA`?(d=0,f=u,p=u*2,m=u*3):o===`RGB`?(d=0,f=u,p=u*2):o===`RBG`&&(d=0,p=u,f=u*2);for(let t=0;t<a;t++)for(let n=0;n<i;n++){let i=(e.data[d++]-l[0])*c[0],a=(e.data[f++]-l[1])*c[1],o=(e.data[p++]-l[2])*c[2],s=m===-1?255:(e.data[m++]-l[3])*c[3];r.fillStyle=`rgba(`+i+`,`+a+`,`+o+`,`+s+`)`,r.fillRect(n,t,1,1)}if(`toDataURL`in n)return n.toDataURL();throw Error(`toDataURL is not supported`)}else throw Error(`Can not access image data`)},E=(e,t)=>{let n=typeof document<`u`?document.createElement(`canvas`).getContext(`2d`):new OffscreenCanvas(1,1).getContext(`2d`),r;if(n!=null){let i,a,o;(t==null?void 0:t.tensorLayout)!==void 0&&t.tensorLayout===`NHWC`?(i=e.dims[2],a=e.dims[1],o=e.dims[3]):(i=e.dims[3],a=e.dims[2],o=e.dims[1]);let s=t!==void 0&&t.format!==void 0?t.format:`RGB`,c=t==null?void 0:t.norm,l,u;c===void 0||c.mean===void 0?l=[255,255,255,255]:typeof c.mean==`number`?l=[c.mean,c.mean,c.mean,c.mean]:(l=[c.mean[0],c.mean[1],c.mean[2],255],c.mean[3]!==void 0&&(l[3]=c.mean[3])),c===void 0||c.bias===void 0?u=[0,0,0,0]:typeof c.bias==`number`?u=[c.bias,c.bias,c.bias,c.bias]:(u=[c.bias[0],c.bias[1],c.bias[2],0],c.bias[3]!==void 0&&(u[3]=c.bias[3]));let d=a*i;if(t!==void 0&&(t.format!==void 0&&o===4&&t.format!==`RGBA`||o===3&&t.format!==`RGB`&&t.format!==`BGR`))throw Error(`Tensor format doesn't match input tensor dims`);let f=0,p=1,m=2,h=3,g=0,_=d,v=d*2,y=-1;s===`RGBA`?(g=0,_=d,v=d*2,y=d*3):s===`RGB`?(g=0,_=d,v=d*2):s===`RBG`&&(g=0,v=d,_=d*2),r=n.createImageData(i,a);for(let t=0;t<a*i;f+=4,p+=4,m+=4,h+=4,t++)r.data[f]=(e.data[g++]-u[0])*l[0],r.data[p]=(e.data[_++]-u[1])*l[1],r.data[m]=(e.data[v++]-u[2])*l[2],r.data[h]=y===-1?255:(e.data[y++]-u[3])*l[3]}else throw Error(`Can not access image data`);return r}}),D,O,ne,re,k,A,ie=c(()=>{me(),D=(e,t)=>{var n,r,i;if(e===void 0)throw Error(`Image buffer must be defined`);if(t.height===void 0||t.width===void 0)throw Error(`Image height and width must be defined`);if(t.tensorLayout===`NHWC`)throw Error(`NHWC Tensor layout is not supported yet`);let{height:a,width:o}=t,s=(n=t.norm)==null?{mean:255,bias:0}:n,c,l;c=typeof s.mean==`number`?[s.mean,s.mean,s.mean,s.mean]:[s.mean[0],s.mean[1],s.mean[2],(r=s.mean[3])==null?255:r],l=typeof s.bias==`number`?[s.bias,s.bias,s.bias,s.bias]:[s.bias[0],s.bias[1],s.bias[2],(i=s.bias[3])==null?0:i];let u=t.format===void 0?`RGBA`:t.format,d=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:`RGB`,f=a*o,p=d===`RGBA`?new Float32Array(f*4):new Float32Array(f*3),m=4,h=0,g=1,_=2,v=3,y=0,b=f,x=f*2,S=-1;u===`RGB`&&(m=3,h=0,g=1,_=2,v=-1),d===`RGBA`?S=f*3:d===`RBG`?(y=0,x=f,b=f*2):d===`BGR`&&(x=0,b=f,y=f*2);for(let t=0;t<f;t++,h+=m,_+=m,g+=m,v+=m)p[y++]=(e[h]+l[0])/c[0],p[b++]=(e[g]+l[1])/c[1],p[x++]=(e[_]+l[2])/c[2],S!==-1&&v!==-1&&(p[S++]=(e[v]+l[3])/c[3]);return d===`RGBA`?new pe(`float32`,p,[1,4,a,o]):new pe(`float32`,p,[1,3,a,o])},O=async(e,t)=>{let n=typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement,r=typeof ImageData<`u`&&e instanceof ImageData,i=typeof ImageBitmap<`u`&&e instanceof ImageBitmap,a=typeof e==`string`,o,s=t==null?{}:t,c=()=>{if(typeof document<`u`)return document.createElement(`canvas`);if(typeof OffscreenCanvas<`u`)return new OffscreenCanvas(1,1);throw Error(`Canvas is not supported`)},l=e=>typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||e instanceof OffscreenCanvas?e.getContext(`2d`):null;if(n){let n=c();n.width=e.width,n.height=e.height;let r=l(n);if(r!=null){let n=e.height,i=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(n=t.resizedHeight,i=t.resizedWidth),t!==void 0){if(s=t,t.tensorFormat!==void 0)throw Error(`Image input config format must be RGBA for HTMLImageElement`);s.tensorFormat=`RGBA`,s.height=n,s.width=i}else s.tensorFormat=`RGBA`,s.height=n,s.width=i;r.drawImage(e,0,0),o=r.getImageData(0,0,i,n).data}else throw Error(`Can not access image data`)}else if(r){let n,r;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(n=t.resizedHeight,r=t.resizedWidth):(n=e.height,r=e.width),t!==void 0&&(s=t),s.format=`RGBA`,s.height=n,s.width=r,t!==void 0){let t=c();t.width=r,t.height=n;let i=l(t);if(i!=null)i.putImageData(e,0,0),o=i.getImageData(0,0,r,n).data;else throw Error(`Can not access image data`)}else o=e.data}else if(i){if(t===void 0)throw Error(`Please provide image config with format for Imagebitmap`);let n=c();n.width=e.width,n.height=e.height;let r=l(n);if(r!=null){let t=e.height,n=e.width;return r.drawImage(e,0,0,n,t),o=r.getImageData(0,0,n,t).data,s.height=t,s.width=n,D(o,s)}else throw Error(`Can not access image data`)}else{if(a)return new Promise((t,n)=>{let r=c(),i=l(r);if(!e||!i)return n();let a=new Image;a.crossOrigin=`Anonymous`,a.src=e,a.onload=()=>{r.width=a.width,r.height=a.height,i.drawImage(a,0,0,r.width,r.height);let e=i.getImageData(0,0,r.width,r.height);s.height=r.height,s.width=r.width,t(D(e.data,s))}});throw Error(`Input data provided is not supported - aborted tensor creation`)}if(o!==void 0)return D(o,s);throw Error(`Input data provided is not supported - aborted tensor creation`)},ne=(e,t)=>{let{width:n,height:r,download:i,dispose:a}=t;return new pe({location:`texture`,type:`float32`,texture:e,dims:[1,r,n,4],download:i,dispose:a})},re=(e,t)=>{let{dataType:n,dims:r,download:i,dispose:a}=t;return new pe({location:`gpu-buffer`,type:n==null?`float32`:n,gpuBuffer:e,dims:r,download:i,dispose:a})},k=(e,t)=>{let{dataType:n,dims:r,download:i,dispose:a}=t;return new pe({location:`ml-tensor`,type:n==null?`float32`:n,mlTensor:e,dims:r,download:i,dispose:a})},A=(e,t,n)=>new pe({location:`cpu-pinned`,type:e,data:t,dims:n==null?[t.length]:n})}),ae,oe,se,ce,le=c(()=>{ae=new Map([[`float32`,Float32Array],[`uint8`,Uint8Array],[`int8`,Int8Array],[`uint16`,Uint16Array],[`int16`,Int16Array],[`int32`,Int32Array],[`bool`,Uint8Array],[`float64`,Float64Array],[`uint32`,Uint32Array],[`int4`,Uint8Array],[`uint4`,Uint8Array]]),oe=new Map([[Float32Array,`float32`],[Uint8Array,`uint8`],[Int8Array,`int8`],[Uint16Array,`uint16`],[Int16Array,`int16`],[Int32Array,`int32`],[Float64Array,`float64`],[Uint32Array,`uint32`]]),se=!1,ce=()=>{if(!se){se=!0;let e=typeof BigInt64Array<`u`&&BigInt64Array.from,t=typeof BigUint64Array<`u`&&BigUint64Array.from,n=globalThis.Float16Array,r=typeof n<`u`&&n.from;e&&(ae.set(`int64`,BigInt64Array),oe.set(BigInt64Array,`int64`)),t&&(ae.set(`uint64`,BigUint64Array),oe.set(BigUint64Array,`uint64`)),r?(ae.set(`float16`,n),oe.set(n,`float16`)):ae.set(`float16`,Uint16Array)}}}),ue,de,fe=c(()=>{me(),ue=e=>{let t=1;for(let n=0;n<e.length;n++){let r=e[n];if(typeof r!=`number`||!Number.isSafeInteger(r))throw TypeError(`dims[${n}] must be an integer, got: ${r}`);if(r<0)throw RangeError(`dims[${n}] must be a non-negative integer, got: ${r}`);t*=r}return t},de=(e,t)=>{switch(e.location){case`cpu`:return new pe(e.type,e.data,t);case`cpu-pinned`:return new pe({location:`cpu-pinned`,data:e.data,type:e.type,dims:t});case`texture`:return new pe({location:`texture`,texture:e.texture,type:e.type,dims:t});case`gpu-buffer`:return new pe({location:`gpu-buffer`,gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case`ml-tensor`:return new pe({location:`ml-tensor`,mlTensor:e.mlTensor,type:e.type,dims:t});default:throw Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),pe,me=c(()=>{te(),ie(),le(),fe(),pe=class{constructor(e,t,n){ce();let r,i;if(typeof e==`object`&&`location`in e)switch(this.dataLocation=e.location,r=e.type,i=e.dims,e.location){case`cpu-pinned`:{let t=ae.get(r);if(!t)throw TypeError(`unsupported type "${r}" to create tensor from pinned buffer`);if(!(e.data instanceof t))throw TypeError(`buffer should be of type ${t.name}`);this.cpuData=e.data;break}case`texture`:if(r!==`float32`)throw TypeError(`unsupported type "${r}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break;case`gpu-buffer`:if(r!==`float32`&&r!==`float16`&&r!==`int32`&&r!==`int64`&&r!==`uint32`&&r!==`uint8`&&r!==`bool`&&r!==`uint4`&&r!==`int4`)throw TypeError(`unsupported type "${r}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break;case`ml-tensor`:if(r!==`float32`&&r!==`float16`&&r!==`int32`&&r!==`int64`&&r!==`uint32`&&r!==`uint64`&&r!==`int8`&&r!==`uint8`&&r!==`bool`&&r!==`uint4`&&r!==`int4`)throw TypeError(`unsupported type "${r}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break;default:throw Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let a,o;if(typeof e==`string`)if(r=e,o=n,e===`string`){if(!Array.isArray(t))throw TypeError(`A string tensor's data must be a string array.`);a=t}else{let n=ae.get(e);if(n===void 0)throw TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e===`float16`&&n===Uint16Array||e===`uint4`||e===`int4`)throw TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${n.name} as data.`);a=e===`uint64`||e===`int64`?n.from(t,BigInt):n.from(t)}else if(t instanceof n)a=t;else if(t instanceof Uint8ClampedArray)if(e===`uint8`)a=Uint8Array.from(t);else throw TypeError(`A Uint8ClampedArray tensor's data must be type of uint8`);else if(e===`float16`&&t instanceof Uint16Array&&n!==Uint16Array)a=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw TypeError(`A ${r} tensor's data must be type of ${n}`)}else if(o=t,Array.isArray(e)){if(e.length===0)throw TypeError(`Tensor type cannot be inferred from an empty array.`);let t=typeof e[0];if(t===`string`)r=`string`,a=e;else if(t===`boolean`)r=`bool`,a=Uint8Array.from(e);else throw TypeError(`Invalid element type of data array: ${t}.`)}else if(e instanceof Uint8ClampedArray)r=`uint8`,a=Uint8Array.from(e);else{let t=oe.get(e.constructor);if(t===void 0)throw TypeError(`Unsupported type for tensor data: ${e.constructor}.`);r=t,a=e}if(o===void 0)o=[a.length];else if(!Array.isArray(o))throw TypeError(`A tensor's dims must be a number array`);i=o,this.cpuData=a,this.dataLocation=`cpu`}let a=ue(i);if(this.cpuData&&a!==this.cpuData.length&&!((r===`uint4`||r===`int4`)&&Math.ceil(a/2)===this.cpuData.length))throw Error(`Tensor's size(${a}) does not match data length(${this.cpuData.length}).`);this.type=r,this.dims=i,this.size=a}static async fromImage(e,t){return O(e,t)}static fromTexture(e,t){return ne(e,t)}static fromGpuBuffer(e,t){return re(e,t)}static fromMLTensor(e,t){return k(e,t)}static fromPinnedBuffer(e,t,n){return A(e,t,n)}toDataURL(e){return ee(this,e)}toImageData(e){return E(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw Error(`The data is not stored as a WebGL texture.`);return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw Error(`The data is not stored as a WebGPU buffer.`);return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw Error(`The data is not stored as a WebNN MLTensor.`);return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case`cpu`:case`cpu-pinned`:return this.data;case`texture`:case`gpu-buffer`:case`ml-tensor`:if(!this.downloader)throw Error(`The current tensor is not created with a specified data downloader.`);if(this.isDownloading)throw Error(`The current tensor is being downloaded.`);try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation=`cpu`,this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}default:throw Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw Error(`The current tensor is being downloaded.`);this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation=`none`}ensureValid(){if(this.dataLocation===`none`)throw Error(`The tensor is disposed.`)}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw Error(`Cannot reshape a tensor that owns GPU resource.`);return de(this,e)}}}),he,ge=c(()=>{me(),he=pe}),_e,ve,ye,be,xe,j,Se=c(()=>{C(),_e=(e,t)=>{(typeof S.trace>`u`?!S.wasm.trace:!S.trace)||console.timeStamp(`${e}::ORT::${t}`)},ve=(e,t)=>{var n;let r=((n=Error().stack)==null?void 0:n.split(/\r\n|\r|\n/g))||[],i=!1;for(let n=0;n<r.length;n++){if(i&&!r[n].includes(`TRACE_FUNC`)){let i=`FUNC_${e}::${r[n].trim().split(` `)[1]}`;t&&(i+=`::${t}`),_e(`CPU`,i);return}r[n].includes(`TRACE_FUNC`)&&(i=!0)}},ye=e=>{(typeof S.trace>`u`?!S.wasm.trace:!S.trace)||ve(`BEGIN`,e)},be=e=>{(typeof S.trace>`u`?!S.wasm.trace:!S.trace)||ve(`END`,e)},xe=e=>{(typeof S.trace>`u`?!S.wasm.trace:!S.trace)||console.time(`ORT::${e}`)},j=e=>{(typeof S.trace>`u`?!S.wasm.trace:!S.trace)||console.timeEnd(`ORT::${e}`)}}),Ce,we=c(()=>{_(),ge(),Se(),Ce=class e{constructor(e){this.handler=e}async run(e,t,n){ye(),xe(`InferenceSession.run`);let r={},i={};if(typeof e!=`object`||!e||e instanceof he||Array.isArray(e))throw TypeError(`'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.`);let a=!0;if(typeof t==`object`){if(t===null)throw TypeError(`Unexpected argument[1]: cannot be null.`);if(t instanceof he)throw TypeError(`'fetches' cannot be a Tensor`);if(Array.isArray(t)){if(t.length===0)throw TypeError(`'fetches' cannot be an empty array.`);a=!1;for(let e of t){if(typeof e!=`string`)throw TypeError(`'fetches' must be a string array or an object.`);if(this.outputNames.indexOf(e)===-1)throw RangeError(`'fetches' contains invalid output name: ${e}.`);r[e]=null}if(typeof n==`object`&&n)i=n;else if(typeof n<`u`)throw TypeError(`'options' must be an object.`)}else{let e=!1,o=Object.getOwnPropertyNames(t);for(let n of this.outputNames)if(o.indexOf(n)!==-1){let i=t[n];(i===null||i instanceof he)&&(e=!0,a=!1,r[n]=i)}if(e){if(typeof n==`object`&&n)i=n;else if(typeof n<`u`)throw TypeError(`'options' must be an object.`)}else i=t}}else if(typeof t<`u`)throw TypeError(`Unexpected argument[1]: must be 'fetches' or 'options'.`);for(let t of this.inputNames)if(typeof e[t]>`u`)throw Error(`input '${t}' is missing in 'feeds'.`);if(a)for(let e of this.outputNames)r[e]=null;let o=await this.handler.run(e,r,i),s={};for(let e in o)if(Object.hasOwnProperty.call(o,e)){let t=o[e];t instanceof he?s[e]=t:s[e]=new he(t.type,t.data,t.dims)}return j(`InferenceSession.run`),be(),s}async release(){return this.handler.dispose()}static async create(t,n,r,i){ye(),xe(`InferenceSession.create`);let a,o={};if(typeof t==`string`){if(a=t,typeof n==`object`&&n)o=n;else if(typeof n<`u`)throw TypeError(`'options' must be an object.`)}else if(t instanceof Uint8Array){if(a=t,typeof n==`object`&&n)o=n;else if(typeof n<`u`)throw TypeError(`'options' must be an object.`)}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<`u`&&t instanceof SharedArrayBuffer){let e=t,s=0,c=t.byteLength;if(typeof n==`object`&&n)o=n;else if(typeof n==`number`){if(s=n,!Number.isSafeInteger(s))throw RangeError(`'byteOffset' must be an integer.`);if(s<0||s>=e.byteLength)throw RangeError(`'byteOffset' is out of range [0, ${e.byteLength}).`);if(c=t.byteLength-s,typeof r==`number`){if(c=r,!Number.isSafeInteger(c))throw RangeError(`'byteLength' must be an integer.`);if(c<=0||s+c>e.byteLength)throw RangeError(`'byteLength' is out of range (0, ${e.byteLength-s}].`);if(typeof i==`object`&&i)o=i;else if(typeof i<`u`)throw TypeError(`'options' must be an object.`)}else if(typeof r<`u`)throw TypeError(`'byteLength' must be a number.`)}else if(typeof n<`u`)throw TypeError(`'options' must be an object.`);a=new Uint8Array(e,s,c)}else throw TypeError(`Unexpected argument[0]: must be 'path' or 'buffer'.`);let[s,c]=await g(o),l=await s.createInferenceSessionHandler(a,c);return j(`InferenceSession.create`),be(),new e(l)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),Te,Ee=c(()=>{we(),Te=Ce}),De=c(()=>{}),Oe=c(()=>{}),ke=c(()=>{}),Ae=c(()=>{}),je={};l(je,{InferenceSession:()=>Te,TRACE:()=>_e,TRACE_EVENT_BEGIN:()=>xe,TRACE_EVENT_END:()=>j,TRACE_FUNC_BEGIN:()=>ye,TRACE_FUNC_END:()=>be,Tensor:()=>he,env:()=>w,registerBackend:()=>m});var Me=c(()=>{v(),T(),Ee(),ge(),De(),Oe(),Se(),ke(),Ae()}),Ne=c(()=>{}),Pe={};l(Pe,{default:()=>Le});var Fe,Ie,Le,Re=c(()=>{var e;Ku(),ft(),rt(),Fe=`ort-wasm-proxy-worker`,Ie=((e=globalThis.self)==null?void 0:e.name)===Fe,Ie&&(self.onmessage=e=>{let{type:t,in:n}=e.data;try{switch(t){case`init-wasm`:dt(n.wasm).then(()=>{Pu(n).then(()=>{postMessage({type:t})},e=>{postMessage({type:t,err:e})})},e=>{postMessage({type:t,err:e})});break;case`init-ep`:{let{epName:e,env:r}=n;Fu(r,e).then(()=>{postMessage({type:t})},e=>{postMessage({type:t,err:e})});break}case`copy-from`:{let{buffer:e}=n,r=zu(e);postMessage({type:t,out:r});break}case`create`:{let{model:e,options:r}=n;Bu(e,r).then(e=>{postMessage({type:t,out:e})},e=>{postMessage({type:t,err:e})});break}case`release`:Vu(n),postMessage({type:t});break;case`run`:{let{sessionId:e,inputIndices:r,inputs:i,outputIndices:a,options:o}=n;Uu(e,r,i,a,Array(a.length).fill(null),o).then(e=>{e.some(e=>e[3]!==`cpu`)?postMessage({type:t,err:`Proxy does not support non-cpu tensor location.`}):postMessage({type:t,out:e},Gu([...i,...e]))},e=>{postMessage({type:t,err:e})});break}case`end-profiling`:Wu(n),postMessage({type:t});break;default:}}catch(e){postMessage({type:t,err:e})}}),Le=Ie?null:e=>new Worker(e==null?qe:e,{type:`module`,name:Fe})}),ze={};l(ze,{default:()=>Ve});async function Be(e={}){var n,r,i=e,a=!!globalThis.window,o=!!globalThis.WorkerGlobalScope,s=o&&((n=self.name)==null?void 0:n.startsWith(`em-pthread`));i.mountExternalData=(e,t)=>{e.startsWith(`./`)&&(e=e.substring(2)),(i.Xc||(i.Xc=new Map)).set(e,t)},i.unmountExternalData=()=>{delete i.Xc},globalThis.SharedArrayBuffer!=null||new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let c=e=>async(...t)=>{try{var n;if(i.Yc)throw Error(`Session already started`);let r=i.Yc={Kd:t[0],errors:[]},a=await e(...t);if(i.Yc!==r)throw Error(`Session mismatch`);(n=i.dd)==null||n.flush();let o=r.errors;if(0<o.length){let e=await Promise.all(o);if(e=e.filter(e=>e),0<e.length)throw Error(e.join(`
`))}return a}finally{i.Yc=null}};i.jsepInit=(e,t)=>{if(e===`webgpu`){[i.dd,i.Ad,i.Ed,i.ed,i.Dd,i.$b,i.Fd,i.Hd,i.Bd,i.Cd,i.Gd]=t;let e=i.dd;i.jsepRegisterBuffer=(t,n,r,i)=>e.registerBuffer(t,n,r,i),i.jsepGetBuffer=t=>e.getBuffer(t),i.jsepCreateDownloader=(t,n,r)=>e.createDownloader(t,n,r),i.jsepOnCreateSession=t=>{e.onCreateSession(t)},i.jsepOnReleaseSession=t=>{e.onReleaseSession(t)},i.jsepOnRunStart=t=>e.onRunStart(t),i.Id=(t,n)=>{e.upload(t,n)}}else if(e===`webnn`){let e=t[0];[i.Sd,i.sd,i.webnnEnsureTensor,i.td,i.webnnDownloadTensor,i.Rd,i.webnnEnableTraceEvent]=t.slice(1),i.webnnReleaseTensorId=i.sd,i.webnnUploadTensor=i.td,i.webnnRegisterMLContext=i.Rd,i.webnnOnRunStart=t=>e.onRunStart(t),i.webnnOnRunEnd=e.onRunEnd.bind(e),i.webnnOnReleaseSession=t=>{e.onReleaseSession(t)},i.webnnCreateMLTensorDownloader=(t,n)=>e.createMLTensorDownloader(t,n),i.webnnRegisterMLTensor=(t,n,r,i)=>e.registerMLTensor(t,n,r,i),i.webnnCreateMLContext=t=>e.createMLContext(t),i.webnnRegisterMLConstant=(t,n,r,a,o,s)=>e.registerMLConstant(t,n,r,a,o,i.Xc,s),i.webnnRegisterGraphInput=e.registerGraphInput.bind(e),i.webnnIsGraphInput=e.isGraphInput.bind(e),i.webnnRegisterGraphOutput=e.registerGraphOutput.bind(e),i.webnnIsGraphOutput=e.isGraphOutput.bind(e),i.webnnCreateTemporaryTensor=e.createTemporaryTensor.bind(e),i.webnnIsGraphInputOutputTypeSupported=e.isGraphInputOutputTypeSupported.bind(e)}};let l=()=>{let e=e=>(...t)=>{let n=tn;return t=e(...t),tn==n?t:new Promise((e,t)=>{ln={resolve:e,reject:t}})};(()=>{for(let t of[`_OrtAppendExecutionProvider`,`_OrtCreateSession`,`_OrtRun`,`_OrtRunWithBinding`,`_OrtBindInput`])i[t]=e(i[t])})(),c!==void 0&&(i._OrtRun=c(i._OrtRun),i._OrtRunWithBinding=c(i._OrtRunWithBinding)),l=void 0};i.asyncInit=()=>{l==null||l()};var u,d,f=(e,t)=>{throw t},p=import.meta.url,m=``;if(a||o){try{m=new URL(`.`,p).href}catch{}o&&(d=e=>{var t=new XMLHttpRequest;return t.open(`GET`,e,!1),t.responseType=`arraybuffer`,t.send(null),new Uint8Array(t.response)}),u=async e=>{if(ee(e))return new Promise((t,n)=>{var r=new XMLHttpRequest;r.open(`GET`,e,!0),r.responseType=`arraybuffer`,r.onload=()=>{r.status==200||r.status==0&&r.response?t(r.response):n(r.status)},r.onerror=n,r.send(null)});var t=await fetch(e,{credentials:`same-origin`});if(t.ok)return t.arrayBuffer();throw Error(t.status+` : `+t.url)}}var h,g,_,v,y,b,x=console.log.bind(console),S=console.error.bind(console),C=x,w=S,T=!1,ee=e=>e.startsWith(`file://`);function E(){Ne.buffer!=D.buffer&&ue()}if(s){let e=function(t){try{var n=t.data,r=n.Sc;if(r===`load`){let t=[];self.onmessage=e=>t.push(e),b=()=>{postMessage({Sc:`loaded`});for(let n of t)e(n);self.onmessage=e};for(let e of n.xd)i[e]&&!i[e].proxy||(i[e]=(...t)=>{postMessage({Sc:`callHandler`,wd:e,args:t})},e==`print`&&(C=i[e]),e==`printErr`&&(w=i[e]));Ne=n.Od,ue(),g=n.Pd,me(),aa()}else if(r===`run`){(function(e){var t=(E(),A)[e+52>>>2>>>0];e=(E(),A)[e+56>>>2>>>0],Tr(t,t-e),Z(t)})(n.Rc),_r(n.Rc,0,0,1,0,0),Ae(),Gt(n.Rc),te||(pr(),te=!0);try{Pe(n.Md,n.bd)}catch(e){if(e!=`unwind`)throw e}}else n.target!==`setimmediate`&&(r===`checkMailbox`?te&&B():r&&(w(`worker: received unknown command ${r}`),w(n)))}catch(e){throw vr(),e}};var te=!1;self.onunhandledrejection=e=>{throw e.reason||e},self.onmessage=e}var D,O,ne,re,k,A,ie,ae,oe,se,ce,le=!1;function ue(){var e=Ne.buffer;i.HEAP8=D=new Int8Array(e),ne=new Int16Array(e),i.HEAPU8=O=new Uint8Array(e),re=new Uint16Array(e),i.HEAP32=k=new Int32Array(e),i.HEAPU32=A=new Uint32Array(e),ie=new Float32Array(e),ae=new Float64Array(e),oe=new BigInt64Array(e),se=new BigUint64Array(e)}function de(){le=!0,s?b():_i.sb()}function fe(e){throw w(e=`Aborted(`+e+`)`),T=!0,e=new WebAssembly.RuntimeError(e+`. Build with -sASSERTIONS for more info.`),y==null||y(e),e}function pe(){return{a:{ma:xi,gb:bi,g:Le,J:ze,f:We,o:Ge,h:Ke,ha:qe,b:Je,T:Ye,Ha:Ze,n:Qe,$:nt,Xa:rt,Da:it,Fa:at,Ya:ot,Va:st,Oa:ct,Ua:lt,ka:ut,Ea:dt,Ba:N,Wa:ft,Ca:pt,bb:mt,ea:xt,wa:St,ua:Ot,da:At,O:L,H:jt,va:Pt,_:Vt,xa:z,Ra:Ht,za:Kt,Ia:Jt,sa:Yt,fa:Xt,Qa:Gt,_a:Zt,R:fn,r:yn,c:Tt,hb:bn,y:xn,M:Sn,D:V,l:H,s:Cn,ib:wn,I:U,S:Tn,j:W,u:G,q:En,k:Dn,La:On,Ma:J,Na:An,Ja:jn,Ka:Mn,ta:Pn,db:Fn,ab:Rn,v:Vn,aa:Hn,ga:Un,$a:In,W:Wn,Za:Gn,Aa:Kn,F:Y,U:qn,la:Qn,ya:$n,fb:Zn,eb:er,Sa:ir,Ta:ar,Ga:we,V:or,ja:sr,Pa:cr,ia:ur,kb:ra,na:Qi,lb:na,oa:Zi,G:Hi,e:Ti,t:Ci,w:Si,B:Fi,mb:Ji,K:zi,x:Oi,pa:Yi,Y:$i,ba:qi,nb:Ki,ob:Gi,P:Ii,qa:Wi,pb:Ui,N:Bi,Z:Xi,d:wi,A:Di,m:Ei,jb:ia,p:Ai,z:ji,C:ki,E:Mi,L:Li,qb:Vi,Q:ea,ca:Ri,X:ta,rb:Pi,ra:Ni,i:dr,a:Ne,cb:Se}}}async function me(){function e(e,t){var n=_i=e.exports;e={};for(let[t,r]of Object.entries(n))typeof r==`function`?(n=$t(r),e[t]=n):e[t]=r;return _i=e,_i=(function(){var e=_i,t=e=>t=>e(t)>>>0,n=e=>()=>e()>>>0;return(e=Object.assign({},e)).tb=t(e.tb),e.Xb=n(e.Xb),e.Zb=t(e.Zb),e.lc=t(e.lc),e.mc=n(e.mc),e.qc=t(e.qc),e})(),De.push(_i._b),fr=(e=_i).tb,pr=e.ub,i._OrtInit=e.vb,i._OrtGetLastError=e.wb,i._OrtCreateSessionOptions=e.xb,i._OrtAppendExecutionProvider=e.yb,i._OrtAddFreeDimensionOverride=e.zb,i._OrtAddSessionConfigEntry=e.Ab,i._OrtReleaseSessionOptions=e.Bb,i._OrtCreateSession=e.Cb,i._OrtReleaseSession=e.Db,i._OrtGetInputOutputCount=e.Eb,i._OrtGetInputOutputMetadata=e.Fb,i._OrtFree=e.Gb,i._OrtCreateTensor=e.Hb,i._OrtGetTensorData=e.Ib,i._OrtReleaseTensor=e.Jb,i._OrtCreateRunOptions=e.Kb,i._OrtAddRunConfigEntry=e.Lb,i._OrtReleaseRunOptions=e.Mb,i._OrtCreateBinding=e.Nb,i._OrtBindInput=e.Ob,i._OrtBindOutput=e.Pb,i._OrtClearBoundOutputs=e.Qb,i._OrtReleaseBinding=e.Rb,i._OrtRunWithBinding=e.Sb,i._OrtRun=e.Tb,i._OrtEndProfiling=e.Ub,i._JsepOutput=e.Vb,i._JsepGetNodeName=e.Wb,mr=e.Xb,hr=i._free=e.Yb,gr=i._malloc=e.Zb,_r=e.ac,vr=e.bc,yr=e.cc,br=e.dc,xr=e.ec,Sr=e.fc,Cr=e.gc,X=e.hc,wr=e.ic,Tr=e.jc,Z=e.kc,Er=e.lc,Q=e.mc,Dr=e.nc,Or=e.oc,kr=e.pc,Ar=e.qc,jr=e.rc,Mr=e.sc,Nr=e.tc,Pr=e.uc,Fr=e.vc,Ir=e.wc,Lr=e.xc,Rr=e.yc,zr=e.zc,Br=e.Ac,Vr=e.Bc,Hr=e.Cc,Ur=e.Dc,Wr=e.Ec,Gr=e.Fc,Kr=e.Gc,qr=e.Hc,Jr=e.Ic,Yr=e.Jc,Xr=e.Kc,Zr=e.Lc,Qr=e.Mc,$r=e.Nc,ei=e.Pc,ti=e.Qc,ni=e.$c,ri=e.ad,ii=e.fd,ai=e.jd,$=e.kd,oi=e.ld,si=e.md,ci=e.nd,li=e.od,ui=e.pd,di=e.qd,fi=e.vd,pi=e.Td,mi=e.Ud,hi=e.Vd,gi=e.Wd,g=t,_i}var t,n=pe();return i.instantiateWasm?new Promise(t=>{i.instantiateWasm(n,(n,r)=>{t(e(n,r))})}):s?e(new WebAssembly.Instance(g,pe()),g):(ce!=null||(ce=i.locateFile?i.locateFile?i.locateFile(`ort-wasm-simd-threaded.jsep.wasm`,m):m+`ort-wasm-simd-threaded.jsep.wasm`:new URL(`/assets/ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm`,``+import.meta.url).href),t=await(async function(e){var t=ce;if(!h&&!ee(t))try{var n=fetch(t,{credentials:`same-origin`});return await WebAssembly.instantiateStreaming(n,e)}catch(e){w(`wasm streaming compile failed: ${e}`),w(`falling back to ArrayBuffer instantiation`)}return(async function(e,t){try{var n=await(async function(e){if(!h)try{var t=await u(e);return new Uint8Array(t)}catch{}if(e==ce&&h)e=new Uint8Array(h);else{if(!d)throw`both async and sync fetching of the wasm failed`;e=d(e)}return e})(e);return await WebAssembly.instantiate(n,t)}catch(e){w(`failed to asynchronously prepare wasm: ${e}`),fe(e)}})(t,e)})(n),e(t.instance,t.module))}class he{constructor(e){t(this,`name`,`ExitStatus`),this.message=`Program terminated with exit(${e})`,this.status=e}}var ge=e=>{e.terminate(),e.onmessage=()=>{}},_e=[],ve=0,ye=null,be=e=>{Te.length==0&&(Me(),je(Te[0]));var t=Te.pop();if(!t)return 6;Ee.push(t),Oe[e.Rc]=t,t.Rc=e.Rc;var n={Sc:`run`,Md:e.Ld,bd:e.bd,Rc:e.Rc};return t.postMessage(n,e.rd),0},xe=0,j=(e,t,...n)=>{var r,i=16*n.length,a=Q(),o=Er(i),s=o>>>3;for(r of n)typeof r==`bigint`?((E(),oe)[s++>>>0]=1n,(E(),oe)[s++>>>0]=r):((E(),oe)[s++>>>0]=0n,(E(),ae)[s++>>>0]=r);return e=yr(e,0,i,o,t),Z(a),e};function Se(e){if(s)return j(0,1,e);if(_=e,!(0<xe)){for(var t of Ee)ge(t);for(t of Te)ge(t);Te=[],Ee=[],Oe={},T=!0}f(0,new he(e))}function Ce(e){if(s)return j(1,0,e);we(e)}var we=e=>{if(_=e,s)throw Ce(e),`unwind`;Se(e)},Te=[],Ee=[],De=[],Oe={},ke=e=>{var t=e.Rc;delete Oe[t],Te.push(e),Ee.splice(Ee.indexOf(e),1),e.Rc=0,br(t)};function Ae(){De.forEach(e=>e())}var je=e=>new Promise(t=>{e.onmessage=n=>{var r=n.data;if(n=r.Sc,r.Zc&&r.Zc!=mr()){var a=Oe[r.Zc];a?a.postMessage(r,r.rd):w(`Internal error! Worker sent a message "${n}" to target pthread ${r.Zc}, but that thread no longer exists!`)}else n===`checkMailbox`?B():n===`spawnThread`?be(r):n===`cleanupThread`?Ut(()=>{ke(Oe[r.Nd])}):n===`loaded`?(e.loaded=!0,t(e)):r.target===`setimmediate`?e.postMessage(r):n===`uncaughtException`?e.onerror(r.error):n===`callHandler`?i[r.wd](...r.args):n&&w(`worker sent an unknown command ${n}`)},e.onerror=e=>{throw w(`worker sent an error! ${e.filename}:${e.lineno}: ${e.message}`),e};var n,r=[];for(n of[])i.propertyIsEnumerable(n)&&r.push(n);e.postMessage({Sc:`load`,xd:r,Od:Ne,Pd:g})});function Me(){var e=new Worker((()=>{let e=URL;return import.meta.url>`file:`&&import.meta.url<`file;`?new e(`ort.bundle.min.mjs`,import.meta.url):new URL(import.meta.url)})(),{type:`module`,workerData:`em-pthread`,name:`em-pthread`});Te.push(e)}var Ne,Pe=(e,t)=>{xe=0,e=Mr(e,t),0<xe?_=e:xr(e)},Fe=[],Ie=0;function Le(e){var t=new He(e>>>=0);return(E(),D)[t.Tc+12>>>0]==0&&(Be(t,!0),Ie--),Ve(t,!1),Fe.push(t),Ar(e)}var Re=0,ze=()=>{X(0,0);var e=Fe.pop();Dr(e.cd),Re=0};function Be(e,t){t=+!!t,(E(),D)[e.Tc+12>>>0]=t}function Ve(e,t){t=+!!t,(E(),D)[e.Tc+13>>>0]=t}class He{constructor(e){this.cd=e,this.Tc=e-24}}var Ue=e=>{var t=Re;if(!t)return wr(0),0;var n=new He(t);(E(),A)[n.Tc+16>>>2>>>0]=t;var r=(E(),A)[n.Tc+4>>>2>>>0];if(!r)return wr(0),t;for(var i of e){if(i===0||i===r)break;if(kr(i,r,n.Tc+16))return wr(i),t}return wr(r),t};function We(){return Ue([])}function Ge(e){return Ue([e>>>0])}function Ke(e,t,n,r){return Ue([e>>>0,t>>>0,n>>>0,r>>>0])}var qe=()=>{var e=Fe.pop();e||fe(`no exception to throw`);var t=e.cd;throw(E(),D)[e.Tc+13>>>0]==0&&(Fe.push(e),Ve(e,!0),Be(e,!1),Ie++),Or(t),Re=t};function Je(e,t,n){var r=new He(e>>>=0);throw t>>>=0,n>>>=0,(E(),A)[r.Tc+16>>>2>>>0]=0,(E(),A)[r.Tc+4>>>2>>>0]=t,(E(),A)[r.Tc+8>>>2>>>0]=n,Or(e),Ie++,Re=e}var Ye=()=>Ie;function Xe(e,t,n,r){return s?j(2,1,e,t,n,r):Ze(e,t,n,r)}function Ze(e,t,n,r){if(e>>>=0,t>>>=0,n>>>=0,r>>>=0,!globalThis.SharedArrayBuffer)return 6;var i=[];return s&&i.length===0?Xe(e,t,n,r):(e={Ld:n,Rc:e,bd:r,rd:i},s?(e.Sc=`spawnThread`,postMessage(e,i),0):be(e))}function Qe(e){throw Re||(Re=e>>>0),Re}var $e=globalThis.TextDecoder&&new TextDecoder,et=(e,t,n,r)=>{if(n=t+n,r)return n;for(;e[t]&&!(t>=n);)++t;return t},tt=(e,t=0,n,r)=>{if(16<(n=et(e,t>>>=0,n,r))-t&&e.buffer&&$e)return $e.decode(e.buffer instanceof ArrayBuffer?e.subarray(t,n):e.slice(t,n));for(r=``;t<n;){var i=e[t++];if(128&i){var a=63&e[t++];if((224&i)==192)r+=String.fromCharCode((31&i)<<6|a);else{var o=63&e[t++];65536>(i=(240&i)==224?(15&i)<<12|a<<6|o:(7&i)<<18|a<<12|o<<6|63&e[t++])?r+=String.fromCharCode(i):(i-=65536,r+=String.fromCharCode(55296|i>>10,56320|1023&i))}}else r+=String.fromCharCode(i)}return r},M=(e,t,n)=>(e>>>=0)?tt((E(),O),e,t,n):``;function nt(e,t,n){return s?j(3,1,e,t,n):0}function rt(e,t){if(s)return j(4,1,e,t)}function it(e,t){if(s)return j(5,1,e,t)}function at(e,t,n){if(s)return j(6,1,e,t,n)}function ot(e,t,n){return s?j(7,1,e,t,n):0}function st(e,t){if(s)return j(8,1,e,t)}function ct(e,t,n){if(s)return j(9,1,e,t,n)}function lt(e,t,n,r){if(s)return j(10,1,e,t,n,r)}function ut(e,t,n,r){if(s)return j(11,1,e,t,n,r)}function dt(e,t,n,r){if(s)return j(12,1,e,t,n,r)}function N(e){if(s)return j(13,1,e)}function ft(e,t){if(s)return j(14,1,e,t)}function pt(e,t,n){if(s)return j(15,1,e,t,n)}var mt=()=>fe(``),P=e=>{e>>>=0;for(var t=``;;){var n=(E(),O)[e++>>>0];if(!n)return t;t+=String.fromCharCode(n)}},ht={},gt={},_t={},vt=class extends Error{constructor(e){super(e),this.name=`BindingError`}};function yt(e,t,n={}){return(function(e,t,n={}){var r=t.name;if(!e)throw new vt(`type "${r}" must have a positive integer typeid pointer`);if(gt.hasOwnProperty(e)){if(n.yd)return;throw new vt(`Cannot register type '${r}' twice`)}gt[e]=t,delete _t[e],ht.hasOwnProperty(e)&&(t=ht[e],delete ht[e],t.forEach(e=>e()))})(e,t,n)}var bt=(e,t,n)=>{switch(t){case 1:return n?e=>(E(),D)[e>>>0]:e=>(E(),O)[e>>>0];case 2:return n?e=>(E(),ne)[e>>>1>>>0]:e=>(E(),re)[e>>>1>>>0];case 4:return n?e=>(E(),k)[e>>>2>>>0]:e=>(E(),A)[e>>>2>>>0];case 8:return n?e=>(E(),oe)[e>>>3>>>0]:e=>(E(),se)[e>>>3>>>0];default:throw TypeError(`invalid integer width (${t}): ${e}`)}};function xt(e,t,n,r,i){e>>>=0,n>>>=0,t=P(t>>>0);let a=e=>e;if(r=r===0n){let e=8*n;a=t=>BigInt.asUintN(e,t),i=a(i)}yt(e,{name:t,Oc:a,Vc:(e,t)=>(typeof t==`number`&&(t=BigInt(t)),t),Uc:bt(t,n,!r),Wc:null})}function St(e,t,n,r){yt(e>>>=0,{name:t=P(t>>>0),Oc:function(e){return!!e},Vc:function(e,t){return t?n:r},Uc:function(e){return this.Oc((E(),O)[e>>>0])},Wc:null})}var Ct=[],wt=[0,1,,1,null,1,!0,1,!1,1];function Tt(e){9<(e>>>=0)&&--wt[e+1]===0&&(wt[e]=void 0,Ct.push(e))}var F=e=>{if(!e)throw new vt(`Cannot use deleted val. handle = ${e}`);return wt[e]},I=e=>{switch(e){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let t=Ct.pop()||wt.length;return wt[t]=e,wt[t+1]=1,t}};function Et(e){return this.Oc((E(),A)[e>>>2>>>0])}var Dt={name:`emscripten::val`,Oc:e=>{var t=F(e);return Tt(e),t},Vc:(e,t)=>I(t),Uc:Et,Wc:null};function Ot(e){return yt(e>>>0,Dt)}var kt=(e,t)=>{switch(t){case 4:return function(e){return this.Oc((E(),ie)[e>>>2>>>0])};case 8:return function(e){return this.Oc((E(),ae)[e>>>3>>>0])};default:throw TypeError(`invalid float width (${t}): ${e}`)}};function At(e,t,n){n>>>=0,yt(e>>>=0,{name:t=P(t>>>0),Oc:e=>e,Vc:(e,t)=>t,Uc:kt(t,n),Wc:null})}function L(e,t,n,r,i){e>>>=0,n>>>=0,t=P(t>>>0);let a=e=>e;if(r===0){var o=32-8*n;a=e=>e<<o>>>o,i=a(i)}yt(e,{name:t,Oc:a,Vc:(e,t)=>t,Uc:bt(t,n,r!==0),Wc:null})}function jt(e,t,n){function r(e){var t=(E(),A)[e>>>2>>>0];return e=(E(),A)[e+4>>>2>>>0],new i((E(),D).buffer,e,t)}var i=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][t];yt(e>>>=0,{name:n=P(n>>>0),Oc:r,Uc:r},{yd:!0})}var Mt=(e,t,n)=>{var r=(E(),O);if(t>>>=0,0<n){var i=t;n=t+n-1;for(var a=0;a<e.length;++a){var o=e.codePointAt(a);if(127>=o){if(t>=n)break;r[t++>>>0]=o}else if(2047>=o){if(t+1>=n)break;r[t++>>>0]=192|o>>6,r[t++>>>0]=128|63&o}else if(65535>=o){if(t+2>=n)break;r[t++>>>0]=224|o>>12,r[t++>>>0]=128|o>>6&63,r[t++>>>0]=128|63&o}else{if(t+3>=n)break;r[t++>>>0]=240|o>>18,r[t++>>>0]=128|o>>12&63,r[t++>>>0]=128|o>>6&63,r[t++>>>0]=128|63&o,a++}}r[t>>>0]=0,e=t-i}else e=0;return e},Nt=e=>{for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);127>=r?t++:2047>=r?t+=2:55296<=r&&57343>=r?(t+=4,++n):t+=3}return t};function Pt(e,t){yt(e>>>=0,{name:t=P(t>>>0),Oc(e){var t=(E(),A)[e>>>2>>>0];return t=M(e+4,t,!0),hr(e),t},Vc(e,t){t instanceof ArrayBuffer&&(t=new Uint8Array(t));var n=typeof t==`string`;if(!(n||ArrayBuffer.isView(t)&&t.BYTES_PER_ELEMENT==1))throw new vt(`Cannot pass non-string to std::string`);var r=n?Nt(t):t.length,i=gr(4+r+1),a=i+4;return(E(),A)[i>>>2>>>0]=r,n?Mt(t,a,r+1):(E(),O).set(t,a>>>0),e!==null&&e.push(hr,i),i},Uc:Et,Wc(e){hr(e)}})}var Ft=globalThis.TextDecoder?new TextDecoder(`utf-16le`):void 0,It=(e,t,n)=>{if(e>>>=1,16<(t=et((E(),re),e,t/2,n))-e&&Ft)return Ft.decode((E(),re).slice(e,t));for(n=``;e<t;++e){var r=(E(),re)[e>>>0];n+=String.fromCharCode(r)}return n},Lt=(e,t,n)=>{if(n!=null||(n=2147483647),2>n)return 0;var r=t;n=(n-=2)<2*e.length?n/2:e.length;for(var i=0;i<n;++i){var a=e.charCodeAt(i);(E(),ne)[t>>>1>>>0]=a,t+=2}return(E(),ne)[t>>>1>>>0]=0,t-r},Rt=e=>2*e.length,R=(e,t,n)=>{var r=``;e>>>=2;for(var i=0;!(i>=t/4);i++){var a=(E(),A)[e+i>>>0];if(!a&&!n)break;r+=String.fromCodePoint(a)}return r},zt=(e,t,n)=>{if(t>>>=0,n!=null||(n=2147483647),4>n)return 0;var r=t;n=r+n-4;for(var i=0;i<e.length;++i){var a=e.codePointAt(i);if(65535<a&&i++,(E(),k)[t>>>2>>>0]=a,(t+=4)+4>n)break}return(E(),k)[t>>>2>>>0]=0,t-r},Bt=e=>{for(var t=0,n=0;n<e.length;++n)65535<e.codePointAt(n)&&n++,t+=4;return t};function Vt(e,t,n){if(e>>>=0,t>>>=0,n=P(n>>>=0),t===2)var r=It,i=Lt,a=Rt;else r=R,i=zt,a=Bt;yt(e,{name:n,Oc:e=>{var n=(E(),A)[e>>>2>>>0];return n=r(e+4,n*t,!0),hr(e),n},Vc:(e,r)=>{if(typeof r!=`string`)throw new vt(`Cannot pass non-string to C++ string type ${n}`);var o=a(r),s=gr(4+o+t);return(E(),A)[s>>>2>>>0]=o/t,i(r,s+4,o+t),e!==null&&e.push(hr,s),s},Uc:Et,Wc(e){hr(e)}})}function z(e,t){yt(e>>>=0,{zd:!0,name:t=P(t>>>0),Oc:()=>{},Vc:()=>{}})}function Ht(e){_r(e>>>0,!o,1,!a,131072,!1),Ae()}var Ut=e=>{if(!T)try{if(e(),!(0<xe))try{s?mr()&&xr(_):we(_)}catch(e){e instanceof he||e==`unwind`||f(0,e)}}catch(e){e instanceof he||e==`unwind`||f(0,e)}},Wt=!Atomics.waitAsync||((r=globalThis.navigator)==null?void 0:r.userAgent)&&91>Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)||[])[2]);function Gt(e){e>>>=0,Wt||(Atomics.waitAsync((E(),k),e>>>2,e).value.then(B),e+=128,Atomics.store((E(),k),e>>>2,1))}var B=()=>Ut(()=>{var e=mr();e&&(Gt(e),Cr())});function Kt(e,t){(e>>>=0)==t>>>0?setTimeout(B):s?postMessage({Zc:e,Sc:`checkMailbox`}):(e=Oe[e])&&e.postMessage({Sc:`checkMailbox`})}var qt=[];function Jt(e,t,n,r,i){for(t>>>=0,i>>>=0,qt.length=0,n=i>>>3,r=i+r>>>3;n<r;){var a=(E(),oe)[n++>>>0]?(E(),oe)[n++>>>0]:(E(),ae)[n++>>>0];qt.push(a)}return(t?yi[t]:vi[e])(...qt)}var Yt=()=>{xe=0};function Xt(e){e>>>=0,s?postMessage({Sc:`cleanupThread`,Nd:e}):ke(Oe[e])}function Zt(e){}var Qt=e=>{try{e()}catch(e){fe(e)}};function $t(e){var t=(...t)=>{rn.push(e);try{return e(...t)}finally{T||(rn.pop(),tn&&en===1&&rn.length===0&&(en=0,xe+=1,Qt(mi),typeof Fibers<`u`&&Fibers.Zd()))}};return sn.set(e,t),t}var en=0,tn=null,nn=0,rn=[],an=new Map,on=new Map,sn=new Map,cn=0,ln=null,un=[],dn=e=>(function(e){if(!T){if(en===0){var t=!1,n=!1;e((e=0)=>{if(!T&&(nn=e,t=!0,n)){en=2,Qt(()=>hi(tn)),typeof MainLoop<`u`&&MainLoop.ud&&MainLoop.resume(),e=!1;try{var r=(function(){var e=(E(),k)[tn+8>>>2>>>0];return e=on.get(e),e=sn.get(e),--xe,e()})()}catch(t){r=t,e=!0}var i=!1;if(!tn){var a=ln;a&&(ln=null,(e?a.reject:a.resolve)(r),i=!0)}if(e&&!i)throw r}}),n=!0,t||(en=1,tn=(function(){var e=gr(65548),t=e+12;if((E(),A)[e>>>2>>>0]=t,(E(),A)[e+4>>>2>>>0]=t+65536,t=rn[0],!an.has(t)){var n=cn++;an.set(t,n),on.set(n,t)}return t=an.get(t),(E(),k)[e+8>>>2>>>0]=t,e})(),typeof MainLoop<`u`&&MainLoop.ud&&MainLoop.pause(),Qt(()=>pi(tn)))}else en===2?(en=0,Qt(gi),hr(tn),tn=null,un.forEach(Ut)):fe(`invalid state: ${en}`);return nn}})(t=>{e().then(t)});function fn(e){return e>>>=0,dn(async()=>I(await F(e)))}var pn=[],mn=e=>{var t=pn.length;return pn.push(e),t},hn=(e,t)=>{for(var n=Array(e),r=0;r<e;++r){var i=r,a=(E(),A)[t+4*r>>>2>>>0],o=gt[a];if(o===void 0)throw e=`parameter ${r}`,a=fr(a),t=P(a),hr(a),new vt(`${e} has unknown type ${t}`);n[i]=o}return n},gn=(e,t,n)=>{var r=[];return e=e(r,n),r.length&&((E(),A)[t>>>2>>>0]=I(r)),e},_n={},vn=e=>{var t=_n[e];return t===void 0?P(e):t};function yn(e,t,n){var[r,...i]=hn(e,t>>>0);t=r.Vc.bind(r);var a=i.map(e=>e.Uc.bind(e));e--;var o={toValue:F};switch(e=a.map((e,t)=>{var n=`argFromPtr${t}`;return o[n]=e,`${n}(args${t?`+`+8*t:``})`}),n){case 0:var s=`toValue(handle)`;break;case 2:s=`new (toValue(handle))`;break;case 3:s=``;break;case 1:o.getStringOrSymbol=vn,s=`toValue(handle)[getStringOrSymbol(methodName)]`}return s+=`(${e})`,r.zd||(o.toReturnWire=t,o.emval_returnValue=gn,s=`return emval_returnValue(toReturnWire, destructorsRef, ${s})`),s=`return function (handle, methodName, destructorsRef, args) {
  ${s}
  }`,n=Function(Object.keys(o),s)(...Object.values(o)),s=`methodCaller<(${i.map(e=>e.name)}) => ${r.name}>`,mn(Object.defineProperty(n,"name",{value:s}))}function bn(e,t){return t>>>=0,(e=F(e>>>0))==F(t)}function xn(e){return(e>>>=0)?(e=vn(e),I(globalThis[e])):I(globalThis)}function Sn(e){return e=vn(e>>>0),I(i[e])}function V(e,t){return t>>>=0,e=F(e>>>0),t=F(t),I(e[t])}function H(e){9<(e>>>=0)&&(wt[e+1]+=1)}function Cn(e,t,n,r,i){return pn[e>>>0](t>>>0,n>>>0,r>>>0,i>>>0)}function wn(e,t,n,r,i){return Cn(e>>>0,t>>>0,n>>>0,r>>>0,i>>>0)}function U(){return I([])}function Tn(e){e=F(e>>>0);for(var t=Array(e.length),n=0;n<e.length;n++)t[n]=e[n];return I(t)}function W(e){return I(vn(e>>>0))}function G(){return I({})}function En(e){for(var t=F(e>>>=0);t.length;){var n=t.pop();t.pop()(n)}Tt(e)}function Dn(e,t,n){t>>>=0,n>>>=0,e=F(e>>>0),t=F(t),n=F(n),e[t]=n}function On(e,t){e=-9007199254740992>e||9007199254740992<e?NaN:Number(e),t>>>=0,e=new Date(1e3*e),(E(),k)[t>>>2>>>0]=e.getUTCSeconds(),(E(),k)[t+4>>>2>>>0]=e.getUTCMinutes(),(E(),k)[t+8>>>2>>>0]=e.getUTCHours(),(E(),k)[t+12>>>2>>>0]=e.getUTCDate(),(E(),k)[t+16>>>2>>>0]=e.getUTCMonth(),(E(),k)[t+20>>>2>>>0]=e.getUTCFullYear()-1900,(E(),k)[t+24>>>2>>>0]=e.getUTCDay(),e=(e.getTime()-Date.UTC(e.getUTCFullYear(),0,1,0,0,0,0))/864e5|0,(E(),k)[t+28>>>2>>>0]=e}var K=e=>e%4==0&&(e%100!=0||e%400==0),kn=[0,31,60,91,121,152,182,213,244,274,305,335],q=[0,31,59,90,120,151,181,212,243,273,304,334];function J(e,t){e=-9007199254740992>e||9007199254740992<e?NaN:Number(e),t>>>=0,e=new Date(1e3*e),(E(),k)[t>>>2>>>0]=e.getSeconds(),(E(),k)[t+4>>>2>>>0]=e.getMinutes(),(E(),k)[t+8>>>2>>>0]=e.getHours(),(E(),k)[t+12>>>2>>>0]=e.getDate(),(E(),k)[t+16>>>2>>>0]=e.getMonth(),(E(),k)[t+20>>>2>>>0]=e.getFullYear()-1900,(E(),k)[t+24>>>2>>>0]=e.getDay();var n=(K(e.getFullYear())?kn:q)[e.getMonth()]+e.getDate()-1|0;(E(),k)[t+28>>>2>>>0]=n,(E(),k)[t+36>>>2>>>0]=-60*e.getTimezoneOffset(),n=new Date(e.getFullYear(),6,1).getTimezoneOffset();var r=new Date(e.getFullYear(),0,1).getTimezoneOffset();e=0|(n!=r&&e.getTimezoneOffset()==Math.min(r,n)),(E(),k)[t+32>>>2>>>0]=e}function An(e){e>>>=0;var t=new Date((E(),k)[e+20>>>2>>>0]+1900,(E(),k)[e+16>>>2>>>0],(E(),k)[e+12>>>2>>>0],(E(),k)[e+8>>>2>>>0],(E(),k)[e+4>>>2>>>0],(E(),k)[e>>>2>>>0],0),n=(E(),k)[e+32>>>2>>>0],r=t.getTimezoneOffset(),i=new Date(t.getFullYear(),6,1).getTimezoneOffset(),a=new Date(t.getFullYear(),0,1).getTimezoneOffset(),o=Math.min(a,i);return 0>n?(E(),k)[e+32>>>2>>>0]=+(i!=a&&o==r):0<n!=(o==r)&&(i=Math.max(a,i),t.setTime(t.getTime()+6e4*((0<n?o:i)-r))),(E(),k)[e+24>>>2>>>0]=t.getDay(),n=(K(t.getFullYear())?kn:q)[t.getMonth()]+t.getDate()-1|0,(E(),k)[e+28>>>2>>>0]=n,(E(),k)[e>>>2>>>0]=t.getSeconds(),(E(),k)[e+4>>>2>>>0]=t.getMinutes(),(E(),k)[e+8>>>2>>>0]=t.getHours(),(E(),k)[e+12>>>2>>>0]=t.getDate(),(E(),k)[e+16>>>2>>>0]=t.getMonth(),(E(),k)[e+20>>>2>>>0]=t.getYear(),e=t.getTime(),BigInt(isNaN(e)?-1:e/1e3)}function jn(e,t,n,r,i,a,o){return s?j(16,1,e,t,n,r,i,a,o):-52}function Mn(e,t,n,r,i,a){if(s)return j(17,1,e,t,n,r,i,a)}var Nn={},Y=()=>performance.timeOrigin+performance.now();function Pn(e,t){return s?j(18,1,e,t):(Nn[e]&&(clearTimeout(Nn[e].id),delete Nn[e]),t&&(Nn[e]={id:setTimeout(()=>{delete Nn[e],Ut(()=>Sr(e,performance.timeOrigin+performance.now()))},t),Yd:t}),0)}function Fn(e,t,n,r){e>>>=0,t>>>=0,n>>>=0,r>>>=0;var i=new Date().getFullYear(),a=new Date(i,0,1).getTimezoneOffset();i=new Date(i,6,1).getTimezoneOffset();var o=Math.max(a,i);(E(),A)[e>>>2>>>0]=60*o,(E(),k)[t>>>2>>>0]=+(a!=i),e=(t=e=>{var t=Math.abs(e);return`UTC${0<=e?`-`:`+`}${String(Math.floor(t/60)).padStart(2,`0`)}${String(t%60).padStart(2,`0`)}`})(a),t=t(i),i<a?(Mt(e,n,17),Mt(t,r,17)):(Mt(e,r,17),Mt(t,n,17))}var In=()=>Date.now(),Ln=1;function Rn(e,t,n){if(n>>>=0,!(0<=e&&3>=e))return 28;if(e===0)e=Date.now();else{if(!Ln)return 52;e=performance.timeOrigin+performance.now()}return e=Math.round(1e6*e),(E(),oe)[n>>>3>>>0]=BigInt(e),0}var zn=[],Bn=(e,t)=>{zn.length=0;for(var n;n=(E(),O)[e++>>>0];){var r=n!=105;t+=(r&=n!=112)&&t%8?4:0,zn.push(n==112?(E(),A)[t>>>2>>>0]:n==106?(E(),oe)[t>>>3>>>0]:n==105?(E(),k)[t>>>2>>>0]:(E(),ae)[t>>>3>>>0]),t+=r?8:4}return zn};function Vn(e,t,n){return e>>>=0,t=Bn(t>>>0,n>>>0),yi[e](...t)}function Hn(e,t,n){return e>>>=0,t=Bn(t>>>0,n>>>0),yi[e](...t)}var Un=()=>{};function Wn(e,t){return w(M(e>>>0,t>>>0))}var Gn=()=>{throw xe+=1,`unwind`};function Kn(){return 4294901760}var qn=()=>navigator.hardwareConcurrency,Jn={},Yn=e=>{var t;return(t=/\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(e))?+t[1]:(t=/:(\d+):\d+(?:\)|$)/.exec(e))?2147483648|t[1]:0},Xn=e=>{for(var t of e)(e=Yn(t))&&(Jn[e]=t)};function Zn(){var e=Error().stack.toString().split(`
`);return e[0]==`Error`&&e.shift(),Xn(e),Jn.gd=Yn(e[3]),Jn.Jd=e,Jn.gd}function Qn(e){var t;if(!(e=Jn[e>>>0]))return 0;var n;if(n=/^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(e))e=n[1];else if(n=/^\s+at (.*) \(.*\)$/.exec(e))e=n[1];else{if(!(n=/^(.+?)@/.exec(e)))return 0;e=n[1]}hr((t=Qn.hd)==null?0:t),n=Nt(e)+1;var r=gr(n);return r&&Mt(e,r,n),Qn.hd=r,Qn.hd}function $n(e){e>>>=0;var t=(E(),O).length;if(e<=t||4294901760<e)return!1;for(var n=1;4>=n;n*=2){var r=t*(1+.2/n);r=Math.min(r,e+100663296);e:{r=(Math.min(4294901760,65536*Math.ceil(Math.max(e,r)/65536))-Ne.buffer.byteLength+65535)/65536|0;try{Ne.grow(r),ue();var i=1;break e}catch{}i=void 0}if(i)return!0}return!1}function er(e,t,n){if(e>>>=0,t>>>=0,Jn.gd==e)var r=Jn.Jd;else(r=Error().stack.toString().split(`
`))[0]==`Error`&&r.shift(),Xn(r);for(var i=3;r[i]&&Yn(r[i])!=e;)++i;for(e=0;e<n&&r[e+i];++e)(E(),k)[t+4*e>>>2>>>0]=Yn(r[e+i]);return e}var tr,nr={},rr=()=>{if(!tr){var e,t,n,r={USER:`web_user`,LOGNAME:`web_user`,PATH:`/`,PWD:`/`,HOME:`/home/web_user`,LANG:((e=(t=globalThis.navigator)==null?void 0:t.language)==null?`C`:e).replace(`-`,`_`)+`.UTF-8`,_:`./this.program`};for(n in nr)nr[n]===void 0?delete r[n]:r[n]=nr[n];var i=[];for(n in r)i.push(`${n}=${r[n]}`);tr=i}return tr};function ir(e,t){if(s)return j(19,1,e,t);e>>>=0,t>>>=0;var n,r=0,i=0;for(n of rr()){var a=t+r;(E(),A)[e+i>>>2>>>0]=a,r+=Mt(n,a,1/0)+1,i+=4}return 0}function ar(e,t){if(s)return j(20,1,e,t);e>>>=0,t>>>=0;var n=rr();for(var r of((E(),A)[e>>>2>>>0]=n.length,e=0,n))e+=Nt(r)+1;return(E(),A)[t>>>2>>>0]=e,0}function or(e){return s?j(21,1,e):52}function sr(e,t,n,r){return s?j(22,1,e,t,n,r):52}function cr(e,t,n,r){return s?j(23,1,e,t,n,r):70}var lr=[null,[],[]];function ur(e,t,n,r){if(s)return j(24,1,e,t,n,r);t>>>=0,n>>>=0,r>>>=0;for(var i=0,a=0;a<n;a++){var o=(E(),A)[t>>>2>>>0],c=(E(),A)[t+4>>>2>>>0];t+=8;for(var l=0;l<c;l++){var u=e,d=(E(),O)[o+l>>>0],f=lr[u];d===0||d===10?((u===1?C:w)(tt(f)),f.length=0):f.push(d)}i+=c}return(E(),A)[r>>>2>>>0]=i,0}function dr(e){return e>>>0}s||(function(){for(var e=i.numThreads-1;e--;)Me();_e.push(async()=>{var e=(async function(){if(!s)return Promise.all(Te.map(je))})();ve++,await e,--ve==0&&ye&&(e=ye,ye=null,e())})})(),s||(Ne=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),ue()),i.wasmBinary&&(h=i.wasmBinary),i.stackSave=()=>Q(),i.stackRestore=e=>Z(e),i.stackAlloc=e=>Er(e),i.setValue=function(e,t,n=`i8`){switch(n.endsWith(`*`)&&(n=`*`),n){case`i1`:case`i8`:(E(),D)[e>>>0]=t;break;case`i16`:(E(),ne)[e>>>1>>>0]=t;break;case`i32`:(E(),k)[e>>>2>>>0]=t;break;case`i64`:(E(),oe)[e>>>3>>>0]=BigInt(t);break;case`float`:(E(),ie)[e>>>2>>>0]=t;break;case`double`:(E(),ae)[e>>>3>>>0]=t;break;case`*`:(E(),A)[e>>>2>>>0]=t;break;default:fe(`invalid type for setValue: ${n}`)}},i.getValue=function(e,t=`i8`){switch(t.endsWith(`*`)&&(t=`*`),t){case`i1`:case`i8`:return(E(),D)[e>>>0];case`i16`:return(E(),ne)[e>>>1>>>0];case`i32`:return(E(),k)[e>>>2>>>0];case`i64`:return(E(),oe)[e>>>3>>>0];case`float`:return(E(),ie)[e>>>2>>>0];case`double`:return(E(),ae)[e>>>3>>>0];case`*`:return(E(),A)[e>>>2>>>0];default:fe(`invalid type for getValue: ${t}`)}},i.UTF8ToString=M,i.stringToUTF8=Mt,i.lengthBytesUTF8=Nt;var fr,pr,mr,hr,gr,_r,vr,yr,br,xr,Sr,Cr,X,wr,Tr,Z,Er,Q,Dr,Or,kr,Ar,jr,Mr,Nr,Pr,Fr,Ir,Lr,Rr,zr,Br,Vr,Hr,Ur,Wr,Gr,Kr,qr,Jr,Yr,Xr,Zr,Qr,$r,ei,ti,ni,ri,ii,ai,$,oi,si,ci,li,ui,di,fi,pi,mi,hi,gi,_i,vi=[Se,Ce,Xe,nt,rt,it,at,ot,st,ct,lt,ut,dt,N,ft,pt,jn,Mn,Pn,ir,ar,or,sr,cr,ur],yi={1003524:(e,t,n,r,a)=>{if(i===void 0||!i.Xc)return 1;if((e=M(Number(e>>>0))).startsWith(`./`)&&(e=e.substring(2)),!(e=i.Xc.get(e)))return 2;if(t=Number(t>>>0),n=Number(n>>>0),r=Number(r>>>0),t+n>e.byteLength)return 3;try{let o=e.subarray(t,t+n);switch(a){case 0:(E(),O).set(o,r>>>0);break;case 1:i.Qd?i.Qd(r,o):i.Id(r,o);break;default:return 4}return 0}catch{return 4}},1004348:(e,t,n)=>{i.td(e,(E(),O).subarray(t>>>0,t+n>>>0))},1004412:()=>i.Sd(),1004454:e=>{i.sd(e)},1004491:()=>{i.Bd()},1004522:()=>{i.Cd()},1004551:()=>{i.Gd()},1004576:e=>i.Ad(e),1004609:e=>i.Ed(e),1004641:(e,t,n)=>{i.ed(Number(e),Number(t),Number(n),!0)},1004704:(e,t,n)=>{i.ed(Number(e),Number(t),Number(n))},1004761:()=>typeof wasmOffsetConverter<`u`,1004818:e=>{i.$b(`Abs`,e,void 0)},1004869:e=>{i.$b(`Neg`,e,void 0)},1004920:e=>{i.$b(`Floor`,e,void 0)},1004973:e=>{i.$b(`Ceil`,e,void 0)},1005025:e=>{i.$b(`Reciprocal`,e,void 0)},1005083:e=>{i.$b(`Sqrt`,e,void 0)},1005135:e=>{i.$b(`Exp`,e,void 0)},1005186:e=>{i.$b(`Erf`,e,void 0)},1005237:e=>{i.$b(`Sigmoid`,e,void 0)},1005292:(e,t,n)=>{i.$b(`HardSigmoid`,e,{alpha:t,beta:n})},1005371:e=>{i.$b(`Log`,e,void 0)},1005422:e=>{i.$b(`Sin`,e,void 0)},1005473:e=>{i.$b(`Cos`,e,void 0)},1005524:e=>{i.$b(`Tan`,e,void 0)},1005575:e=>{i.$b(`Asin`,e,void 0)},1005627:e=>{i.$b(`Acos`,e,void 0)},1005679:e=>{i.$b(`Atan`,e,void 0)},1005731:e=>{i.$b(`Sinh`,e,void 0)},1005783:e=>{i.$b(`Cosh`,e,void 0)},1005835:e=>{i.$b(`Asinh`,e,void 0)},1005888:e=>{i.$b(`Acosh`,e,void 0)},1005941:e=>{i.$b(`Atanh`,e,void 0)},1005994:e=>{i.$b(`Tanh`,e,void 0)},1006046:e=>{i.$b(`Not`,e,void 0)},1006097:(e,t,n)=>{i.$b(`Clip`,e,{min:t,max:n})},1006166:e=>{i.$b(`Clip`,e,void 0)},1006218:(e,t)=>{i.$b(`Elu`,e,{alpha:t})},1006276:e=>{i.$b(`Gelu`,e,void 0)},1006328:e=>{i.$b(`Relu`,e,void 0)},1006380:(e,t)=>{i.$b(`LeakyRelu`,e,{alpha:t})},1006444:(e,t)=>{i.$b(`ThresholdedRelu`,e,{alpha:t})},1006514:(e,t)=>{i.$b(`Cast`,e,{to:t})},1006572:e=>{i.$b(`Add`,e,void 0)},1006623:e=>{i.$b(`Sub`,e,void 0)},1006674:e=>{i.$b(`Mul`,e,void 0)},1006725:e=>{i.$b(`Div`,e,void 0)},1006776:e=>{i.$b(`Pow`,e,void 0)},1006827:e=>{i.$b(`Equal`,e,void 0)},1006880:e=>{i.$b(`Greater`,e,void 0)},1006935:e=>{i.$b(`GreaterOrEqual`,e,void 0)},1006997:e=>{i.$b(`Less`,e,void 0)},1007049:e=>{i.$b(`LessOrEqual`,e,void 0)},1007108:(e,t,n,r,a)=>{i.$b(`ReduceMean`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1007283:(e,t,n,r,a)=>{i.$b(`ReduceMax`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1007457:(e,t,n,r,a)=>{i.$b(`ReduceMin`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1007631:(e,t,n,r,a)=>{i.$b(`ReduceProd`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1007806:(e,t,n,r,a)=>{i.$b(`ReduceSum`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1007980:(e,t,n,r,a)=>{i.$b(`ReduceL1`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1008153:(e,t,n,r,a)=>{i.$b(`ReduceL2`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1008326:(e,t,n,r,a)=>{i.$b(`ReduceLogSum`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1008503:(e,t,n,r,a)=>{i.$b(`ReduceSumSquare`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1008683:(e,t,n,r,a)=>{i.$b(`ReduceLogSumExp`,e,{keepDims:!!t,noopWithEmptyAxes:!!n,axes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1008863:e=>{i.$b(`Where`,e,void 0)},1008916:(e,t,n)=>{i.$b(`Transpose`,e,{perm:t?Array.from((E(),k).subarray(Number(t)>>>0,Number(n)>>>0)):[]})},1009040:(e,t,n,r)=>{i.$b(`DepthToSpace`,e,{blocksize:t,mode:M(n),format:r?`NHWC`:`NCHW`})},1009173:(e,t,n,r)=>{i.$b(`DepthToSpace`,e,{blocksize:t,mode:M(n),format:r?`NHWC`:`NCHW`})},1009306:(e,t,n,r,a,o,s,c,l,u,d,f,p,m,h)=>{i.$b(`ConvTranspose`,e,{format:l?`NHWC`:`NCHW`,autoPad:t,dilations:[n],group:r,kernelShape:[a],pads:[o,s],strides:[c],wIsConst:()=>!!(E(),D)[u>>>0],outputPadding:d?Array.from((E(),k).subarray(Number(d)>>>0,Number(f)>>>0)):[],outputShape:p?Array.from((E(),k).subarray(Number(p)>>>0,Number(m)>>>0)):[],activation:M(h)})},1009739:(e,t,n,r,a,o,s,c,l,u,d,f,p,m)=>{i.$b(`ConvTranspose`,e,{format:c?`NHWC`:`NCHW`,autoPad:t,dilations:Array.from((E(),k).subarray(Number(n)>>>0,(Number(n)>>>0)+2>>>0)),group:r,kernelShape:Array.from((E(),k).subarray(Number(a)>>>0,(Number(a)>>>0)+2>>>0)),pads:Array.from((E(),k).subarray(Number(o)>>>0,(Number(o)>>>0)+4>>>0)),strides:Array.from((E(),k).subarray(Number(s)>>>0,(Number(s)>>>0)+2>>>0)),wIsConst:()=>!!(E(),D)[l>>>0],outputPadding:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],outputShape:f?Array.from((E(),k).subarray(Number(f)>>>0,Number(p)>>>0)):[],activation:M(m)})},1010400:(e,t,n,r,a,o,s,c,l,u,d,f,p,m,h)=>{i.$b(`ConvTranspose`,e,{format:l?`NHWC`:`NCHW`,autoPad:t,dilations:[n],group:r,kernelShape:[a],pads:[o,s],strides:[c],wIsConst:()=>!!(E(),D)[u>>>0],outputPadding:d?Array.from((E(),k).subarray(Number(d)>>>0,Number(f)>>>0)):[],outputShape:p?Array.from((E(),k).subarray(Number(p)>>>0,Number(m)>>>0)):[],activation:M(h)})},1010833:(e,t,n,r,a,o,s,c,l,u,d,f,p,m)=>{i.$b(`ConvTranspose`,e,{format:c?`NHWC`:`NCHW`,autoPad:t,dilations:Array.from((E(),k).subarray(Number(n)>>>0,(Number(n)>>>0)+2>>>0)),group:r,kernelShape:Array.from((E(),k).subarray(Number(a)>>>0,(Number(a)>>>0)+2>>>0)),pads:Array.from((E(),k).subarray(Number(o)>>>0,(Number(o)>>>0)+4>>>0)),strides:Array.from((E(),k).subarray(Number(s)>>>0,(Number(s)>>>0)+2>>>0)),wIsConst:()=>!!(E(),D)[l>>>0],outputPadding:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],outputShape:f?Array.from((E(),k).subarray(Number(f)>>>0,Number(p)>>>0)):[],activation:M(m)})},1011494:(e,t)=>{i.$b(`GlobalAveragePool`,e,{format:t?`NHWC`:`NCHW`})},1011585:(e,t,n,r,a,o,s,c,l,u,d,f,p,m)=>{i.$b(`AveragePool`,e,{format:m?`NHWC`:`NCHW`,auto_pad:t,ceil_mode:n,count_include_pad:r,storage_order:a,dilations:o?Array.from((E(),k).subarray(Number(o)>>>0,Number(s)>>>0)):[],kernel_shape:c?Array.from((E(),k).subarray(Number(c)>>>0,Number(l)>>>0)):[],pads:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],strides:f?Array.from((E(),k).subarray(Number(f)>>>0,Number(p)>>>0)):[]})},1012064:(e,t)=>{i.$b(`GlobalAveragePool`,e,{format:t?`NHWC`:`NCHW`})},1012155:(e,t,n,r,a,o,s,c,l,u,d,f,p,m)=>{i.$b(`AveragePool`,e,{format:m?`NHWC`:`NCHW`,auto_pad:t,ceil_mode:n,count_include_pad:r,storage_order:a,dilations:o?Array.from((E(),k).subarray(Number(o)>>>0,Number(s)>>>0)):[],kernel_shape:c?Array.from((E(),k).subarray(Number(c)>>>0,Number(l)>>>0)):[],pads:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],strides:f?Array.from((E(),k).subarray(Number(f)>>>0,Number(p)>>>0)):[]})},1012634:(e,t)=>{i.$b(`GlobalMaxPool`,e,{format:t?`NHWC`:`NCHW`})},1012721:(e,t,n,r,a,o,s,c,l,u,d,f,p,m)=>{i.$b(`MaxPool`,e,{format:m?`NHWC`:`NCHW`,auto_pad:t,ceil_mode:n,count_include_pad:r,storage_order:a,dilations:o?Array.from((E(),k).subarray(Number(o)>>>0,Number(s)>>>0)):[],kernel_shape:c?Array.from((E(),k).subarray(Number(c)>>>0,Number(l)>>>0)):[],pads:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],strides:f?Array.from((E(),k).subarray(Number(f)>>>0,Number(p)>>>0)):[]})},1013196:(e,t)=>{i.$b(`GlobalMaxPool`,e,{format:t?`NHWC`:`NCHW`})},1013283:(e,t,n,r,a,o,s,c,l,u,d,f,p,m)=>{i.$b(`MaxPool`,e,{format:m?`NHWC`:`NCHW`,auto_pad:t,ceil_mode:n,count_include_pad:r,storage_order:a,dilations:o?Array.from((E(),k).subarray(Number(o)>>>0,Number(s)>>>0)):[],kernel_shape:c?Array.from((E(),k).subarray(Number(c)>>>0,Number(l)>>>0)):[],pads:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],strides:f?Array.from((E(),k).subarray(Number(f)>>>0,Number(p)>>>0)):[]})},1013758:(e,t,n,r,a)=>{i.$b(`Gemm`,e,{alpha:t,beta:n,transA:r,transB:a})},1013862:e=>{i.$b(`MatMul`,e,void 0)},1013916:(e,t,n,r)=>{i.$b(`ArgMax`,e,{keepDims:!!t,selectLastIndex:!!n,axis:r})},1014024:(e,t,n,r)=>{i.$b(`ArgMin`,e,{keepDims:!!t,selectLastIndex:!!n,axis:r})},1014132:(e,t)=>{i.$b(`Softmax`,e,{axis:t})},1014195:(e,t)=>{i.$b(`Concat`,e,{axis:t})},1014255:(e,t,n,r,a)=>{i.$b(`Split`,e,{axis:t,numOutputs:n,splitSizes:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1014411:e=>{i.$b(`Expand`,e,void 0)},1014465:(e,t)=>{i.$b(`Gather`,e,{axis:Number(t)})},1014536:(e,t)=>{i.$b(`GatherElements`,e,{axis:Number(t)})},1014615:(e,t)=>{i.$b(`GatherND`,e,{batch_dims:Number(t)})},1014694:(e,t,n,r,a,o,s,c,l,u,d)=>{i.$b(`Resize`,e,{antialias:t,axes:n?Array.from((E(),k).subarray(Number(n)>>>0,Number(r)>>>0)):[],coordinateTransformMode:M(a),cubicCoeffA:o,excludeOutside:s,extrapolationValue:c,keepAspectRatioPolicy:M(l),mode:M(u),nearestMode:M(d)})},1015056:(e,t,n,r,a,o,s)=>{i.$b(`Slice`,e,{starts:t?Array.from((E(),k).subarray(Number(t)>>>0,Number(n)>>>0)):[],ends:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[],axes:o?Array.from((E(),k).subarray(Number(o)>>>0,Number(s)>>>0)):[]})},1015320:e=>{i.$b(`Tile`,e,void 0)},1015372:(e,t,n)=>{i.$b(`InstanceNormalization`,e,{epsilon:t,format:n?`NHWC`:`NCHW`})},1015486:(e,t,n)=>{i.$b(`InstanceNormalization`,e,{epsilon:t,format:n?`NHWC`:`NCHW`})},1015600:e=>{i.$b(`Range`,e,void 0)},1015653:(e,t)=>{i.$b(`Einsum`,e,{equation:M(t)})},1015734:(e,t,n,r,a)=>{i.$b(`Pad`,e,{mode:t,value:n,pads:r?Array.from((E(),k).subarray(Number(r)>>>0,Number(a)>>>0)):[]})},1015877:(e,t,n,r,a,o)=>{i.$b(`BatchNormalization`,e,{epsilon:t,momentum:n,spatial:!!a,trainingMode:!!r,format:o?`NHWC`:`NCHW`})},1016046:(e,t,n,r,a,o)=>{i.$b(`BatchNormalization`,e,{epsilon:t,momentum:n,spatial:!!a,trainingMode:!!r,format:o?`NHWC`:`NCHW`})},1016215:(e,t,n)=>{i.$b(`CumSum`,e,{exclusive:Number(t),reverse:Number(n)})},1016312:(e,t,n)=>{i.$b(`DequantizeLinear`,e,{axis:t,blockSize:n})},1016402:(e,t,n,r,a)=>{i.$b(`GridSample`,e,{align_corners:t,mode:M(n),padding_mode:M(r),format:a?`NHWC`:`NCHW`})},1016572:(e,t,n,r,a)=>{i.$b(`GridSample`,e,{align_corners:t,mode:M(n),padding_mode:M(r),format:a?`NHWC`:`NCHW`})},1016742:(e,t)=>{i.$b(`ScatterND`,e,{reduction:M(t)})},1016827:(e,t,n,r,a,o,s,c,l)=>{i.$b(`Attention`,e,{numHeads:t,isUnidirectional:n,maskFilterValue:r,scale:a,doRotary:o,qkvHiddenSizes:s?Array.from((E(),k).subarray(Number(c)>>>0,Number(c)+s>>>0)):[],pastPresentShareBuffer:!!l})},1017099:e=>{i.$b(`BiasAdd`,e,void 0)},1017154:e=>{i.$b(`BiasSplitGelu`,e,void 0)},1017215:e=>{i.$b(`FastGelu`,e,void 0)},1017271:(e,t,n,r,a,o,s,c,l,u,d,f,p,m,h,g)=>{i.$b(`Conv`,e,{format:f?`NHWC`:`NCHW`,auto_pad:t,dilations:n?Array.from((E(),k).subarray(Number(n)>>>0,Number(r)>>>0)):[],group:a,kernel_shape:o?Array.from((E(),k).subarray(Number(o)>>>0,Number(s)>>>0)):[],pads:c?Array.from((E(),k).subarray(Number(c)>>>0,Number(l)>>>0)):[],strides:u?Array.from((E(),k).subarray(Number(u)>>>0,Number(d)>>>0)):[],w_is_const:()=>!!(E(),D)[Number(p)>>>0],activation:M(m),activation_params:h?Array.from((E(),ie).subarray(Number(h)>>>0,Number(g)>>>0)):[]})},1017855:e=>{i.$b(`Gelu`,e,void 0)},1017907:(e,t,n,r,a,o,s,c,l)=>{i.$b(`GroupQueryAttention`,e,{numHeads:t,kvNumHeads:n,scale:r,softcap:a,doRotary:o,rotaryInterleaved:s,smoothSoftmax:c,localWindowSize:l})},1018124:(e,t,n,r)=>{i.$b(`LayerNormalization`,e,{axis:t,epsilon:n,simplified:!!r})},1018235:(e,t,n,r)=>{i.$b(`LayerNormalization`,e,{axis:t,epsilon:n,simplified:!!r})},1018346:(e,t,n,r,a,o)=>{i.$b(`MatMulNBits`,e,{k:t,n,accuracyLevel:r,bits:a,blockSize:o})},1018473:(e,t,n,r,a,o)=>{i.$b(`MultiHeadAttention`,e,{numHeads:t,isUnidirectional:n,maskFilterValue:r,scale:a,doRotary:o})},1018632:(e,t)=>{i.$b(`QuickGelu`,e,{alpha:t})},1018696:(e,t,n,r,a)=>{i.$b(`RotaryEmbedding`,e,{interleaved:!!t,numHeads:n,rotaryEmbeddingDim:r,scale:a})},1018835:(e,t,n)=>{i.$b(`SkipLayerNormalization`,e,{epsilon:t,simplified:!!n})},1018937:(e,t,n)=>{i.$b(`SkipLayerNormalization`,e,{epsilon:t,simplified:!!n})},1019039:(e,t,n,r)=>{i.$b(`GatherBlockQuantized`,e,{gatherAxis:t,quantizeAxis:n,blockSize:r})},1019160:e=>{i.Fd(e)},1019194:(e,t)=>i.Hd(Number(e),Number(t),i.Yc.Kd,i.Yc.errors)};function bi(e,t,n){return dn(async()=>{await i.Dd(Number(e),Number(t),Number(n))})}function xi(){return typeof wasmOffsetConverter<`u`}function Si(e,t,n,r){var i=Q();try{return Br(e,t,n,r)}catch(e){if(Z(i),e!==e+0)throw e;X(1,0)}}function Ci(e,t,n){var r=Q();try{return Ir(e,t,n)}catch(e){if(Z(r),e!==e+0)throw e;X(1,0)}}function wi(e){var t=Q();try{Nr(e)}catch(e){if(Z(t),e!==e+0)throw e;X(1,0)}}function Ti(e,t){var n=Q();try{return Mr(e,t)}catch(e){if(Z(n),e!==e+0)throw e;X(1,0)}}function Ei(e,t,n){var r=Q();try{jr(e,t,n)}catch(e){if(Z(r),e!==e+0)throw e;X(1,0)}}function Di(e,t){var n=Q();try{Vr(e,t)}catch(e){if(Z(n),e!==e+0)throw e;X(1,0)}}function Oi(e,t,n,r,i,a,o){var s=Q();try{return Rr(e,t,n,r,i,a,o)}catch(e){if(Z(s),e!==e+0)throw e;X(1,0)}}function ki(e,t,n,r,i,a){var o=Q();try{Pr(e,t,n,r,i,a)}catch(e){if(Z(o),e!==e+0)throw e;X(1,0)}}function Ai(e,t,n,r){var i=Q();try{zr(e,t,n,r)}catch(e){if(Z(i),e!==e+0)throw e;X(1,0)}}function ji(e,t,n,r,i){var a=Q();try{Fr(e,t,n,r,i)}catch(e){if(Z(a),e!==e+0)throw e;X(1,0)}}function Mi(e,t,n,r,i,a,o){var s=Q();try{Ur(e,t,n,r,i,a,o)}catch(e){if(Z(s),e!==e+0)throw e;X(1,0)}}function Ni(e,t,n,r,i,a,o){var s=Q();try{Wr(e,t,n,r,i,a,o)}catch(e){if(Z(s),e!==e+0)throw e;X(1,0)}}function Pi(e,t,n,r,i,a,o,s){var c=Q();try{Jr(e,t,n,r,i,a,o,s)}catch(e){if(Z(c),e!==e+0)throw e;X(1,0)}}function Fi(e,t,n,r,i){var a=Q();try{return Hr(e,t,n,r,i)}catch(e){if(Z(a),e!==e+0)throw e;X(1,0)}}function Ii(e,t,n){var r=Q();try{return Yr(e,t,n)}catch(e){if(Z(r),e!==e+0)throw e;X(1,0)}}function Li(e,t,n,r,i,a,o,s){var c=Q();try{Xr(e,t,n,r,i,a,o,s)}catch(e){if(Z(c),e!==e+0)throw e;X(1,0)}}function Ri(e,t,n,r,i,a,o,s,c,l,u,d){var f=Q();try{Gr(e,t,n,r,i,a,o,s,c,l,u,d)}catch(e){if(Z(f),e!==e+0)throw e;X(1,0)}}function zi(e,t,n,r,i,a){var o=Q();try{return Kr(e,t,n,r,i,a)}catch(e){if(Z(o),e!==e+0)throw e;X(1,0)}}function Bi(e,t,n){var r=Q();try{return Zr(e,t,n)}catch(e){if(Z(r),e!==e+0)throw e;return X(1,0),0n}}function Vi(e,t,n,r,i,a,o,s,c){var l=Q();try{Lr(e,t,n,r,i,a,o,s,c)}catch(e){if(Z(l),e!==e+0)throw e;X(1,0)}}function Hi(e){var t=Q();try{return Qr(e)}catch(e){if(Z(t),e!==e+0)throw e;X(1,0)}}function Ui(e,t){var n=Q();try{return fi(e,t)}catch(e){if(Z(n),e!==e+0)throw e;return X(1,0),0n}}function Wi(e){var t=Q();try{return $r(e)}catch(e){if(Z(t),e!==e+0)throw e;return X(1,0),0n}}function Gi(e,t,n,r){var i=Q();try{return ai(e,t,n,r)}catch(e){if(Z(i),e!==e+0)throw e;X(1,0)}}function Ki(e,t,n,r,i){var a=Q();try{return $(e,t,n,r,i)}catch(e){if(Z(a),e!==e+0)throw e;X(1,0)}}function qi(e,t,n,r,i,a){var o=Q();try{return oi(e,t,n,r,i,a)}catch(e){if(Z(o),e!==e+0)throw e;X(1,0)}}function Ji(e,t,n,r,i,a){var o=Q();try{return si(e,t,n,r,i,a)}catch(e){if(Z(o),e!==e+0)throw e;X(1,0)}}function Yi(e,t,n,r,i,a,o,s){var c=Q();try{return qr(e,t,n,r,i,a,o,s)}catch(e){if(Z(c),e!==e+0)throw e;X(1,0)}}function Xi(e,t,n,r,i){var a=Q();try{return ci(e,t,n,r,i)}catch(e){if(Z(a),e!==e+0)throw e;return X(1,0),0n}}function Zi(e,t,n,r){var i=Q();try{return li(e,t,n,r)}catch(e){if(Z(i),e!==e+0)throw e;X(1,0)}}function Qi(e,t,n,r){var i=Q();try{return ui(e,t,n,r)}catch(e){if(Z(i),e!==e+0)throw e;X(1,0)}}function $i(e,t,n,r,i,a,o,s,c,l,u,d){var f=Q();try{return di(e,t,n,r,i,a,o,s,c,l,u,d)}catch(e){if(Z(f),e!==e+0)throw e;X(1,0)}}function ea(e,t,n,r,i,a,o,s,c,l,u){var d=Q();try{ri(e,t,n,r,i,a,o,s,c,l,u)}catch(e){if(Z(d),e!==e+0)throw e;X(1,0)}}function ta(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){var g=Q();try{ii(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}catch(e){if(Z(g),e!==e+0)throw e;X(1,0)}}function na(e,t,n){var r=Q();try{return ei(e,t,n)}catch(e){if(Z(r),e!==e+0)throw e;X(1,0)}}function ra(e,t,n){var r=Q();try{return ti(e,t,n)}catch(e){if(Z(r),e!==e+0)throw e;X(1,0)}}function ia(e,t,n,r){var i=Q();try{ni(e,t,n,r)}catch(e){if(Z(i),e!==e+0)throw e;X(1,0)}}function aa(){if(0<ve)ye=aa;else if(s)v==null||v(i),de();else{for(var e=_e;0<e.length;)e.shift()(i);0<ve?ye=aa:(i.calledRun=!0,T||(de(),v==null||v(i)))}}return s||(_i=await me(),aa()),i.PTR_SIZE=4,le?i:new Promise((e,t)=>{v=e,y=t})}var Ve,He,Ue=c(()=>{var e;Ve=Be,He=(e=globalThis.self)==null||(e=e.name)==null?void 0:e.startsWith(`em-pthread`),He&&Be()}),We,Ge,Ke,qe,Je,Ye,Xe,Ze,Qe,$e,et,tt,M,nt,rt=c(()=>{Ne(),We=typeof location>`u`?void 0:location.origin,Ge=import.meta.url>`file:`&&import.meta.url<`file;`,Ke=()=>Ge?new URL(new URL(`ort.bundle.min.mjs`,import.meta.url).href,We).href:import.meta.url,qe=Ke(),Je=()=>{if(qe&&!qe.startsWith(`blob:`))return qe.substring(0,qe.lastIndexOf(`/`)+1)},Ye=(e,t)=>{try{let n=t==null?qe:t;return(n?new URL(e,n):new URL(e)).origin===We}catch{return!1}},Xe=(e,t)=>{let n=t==null?qe:t;try{return(n?new URL(e,n):new URL(e)).href}catch{return}},Ze=(e,t)=>`${t==null?`./`:t}${e}`,Qe=async e=>{let t=await(await fetch(e,{credentials:`same-origin`})).blob();return URL.createObjectURL(t)},$e=async e=>(await n(async()=>{let{default:t}=await import(e);return{default:t}},[])).default,et=(Re(),d(Pe)).default,tt=async()=>{if(!qe)throw Error(`Failed to load proxy worker: cannot determine the script source URL.`);if(Ye(qe))return[void 0,et()];let e=await Qe(qe);return[e,et(e)]},M=(Ue(),d(ze)).default,nt=async(e,t,n,r)=>{let i=M&&!(e||t);if(i)if(qe)i=Ye(qe)||r&&!n;else if(r&&!n)i=!0;else throw Error(`cannot determine the script source URL.`);if(i)return[void 0,M];{let r=`ort-wasm-simd-threaded.jsep.mjs`,i=e==null?Xe(r,t):e,a=n&&i&&!Ye(i,t),o=a?await Qe(i):i==null?Ze(r,t):i;return[a?o:void 0,await $e(o)]}}}),it,at,ot,st,ct,lt,ut,dt,N,ft=c(()=>{rt(),at=!1,ot=!1,st=!1,ct=()=>{if(typeof SharedArrayBuffer>`u`)return!1;try{return typeof MessageChannel<`u`&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},lt=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},ut=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},dt=async e=>{var t,n;if(at)return Promise.resolve();if(ot)throw Error(`multiple calls to 'initializeWebAssembly()' detected.`);if(st)throw Error(`previous call to 'initializeWebAssembly()' failed.`);ot=!0;let r=e.initTimeout,i=e.numThreads;if(e.simd!==!1){if(e.simd===`relaxed`){if(!ut())throw Error(`Relaxed WebAssembly SIMD is not supported in the current environment.`)}else if(!lt())throw Error(`WebAssembly SIMD is not supported in the current environment.`)}let a=ct();i>1&&!a&&(typeof self<`u`&&!self.crossOriginIsolated&&console.warn(`env.wasm.numThreads is set to `+i+`, but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info.`),console.warn(`WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading.`),e.numThreads=i=1);let o=e.wasmPaths,s=typeof o==`string`?o:void 0,c=o==null?void 0:o.mjs,l=(t=c==null?void 0:c.href)==null?c:t,u=o==null?void 0:o.wasm,d=(n=u==null?void 0:u.href)==null?u:n,f=e.wasmBinary,[p,m]=await nt(l,s,i>1,!!f||!!d),h=!1,g=[];if(r>0&&g.push(new Promise(e=>{setTimeout(()=>{h=!0,e()},r)})),g.push(new Promise((e,t)=>{let n={numThreads:i};if(f)n.wasmBinary=f,n.locateFile=e=>e;else if(d||s)n.locateFile=e=>d==null?s+e:d;else if(l&&l.indexOf(`blob:`)!==0)n.locateFile=e=>new URL(e,l).href;else if(p){let e=Je();e&&(n.locateFile=t=>e+t)}m(n).then(t=>{ot=!1,at=!0,it=t,e(),p&&URL.revokeObjectURL(p)},e=>{ot=!1,st=!0,t(e)})})),await Promise.race(g),h)throw Error(`WebAssembly backend initializing failed due to timeout: ${r}ms`)},N=()=>{if(at&&it)return it;throw Error(`WebAssembly is not initialized yet.`)}}),pt,mt,P,ht=c(()=>{ft(),pt=(e,t)=>{let n=N(),r=n.lengthBytesUTF8(e)+1,i=n._malloc(r);return n.stringToUTF8(e,i,r),t.push(i),i},mt=(e,t,n,r)=>{if(typeof e==`object`&&e){if(n.has(e))throw Error(`Circular reference in options`);n.add(e)}Object.entries(e).forEach(([e,i])=>{let a=t?t+e:e;if(typeof i==`object`)mt(i,a+`.`,n,r);else if(typeof i==`string`||typeof i==`number`)r(a,i.toString());else if(typeof i==`boolean`)r(a,i?`1`:`0`);else throw Error(`Can't handle extra config type: ${typeof i}`)})},P=e=>{let t=N(),n=t.stackSave();try{let n=t.PTR_SIZE,r=t.stackAlloc(2*n);t._OrtGetLastError(r,r+n);let i=Number(t.getValue(r,n===4?`i32`:`i64`)),a=t.getValue(r+n,`*`),o=a?t.UTF8ToString(a):``;throw Error(`${e} ERROR_CODE: ${i}, ERROR_MESSAGE: ${o}`)}finally{t.stackRestore(n)}}}),gt,_t=c(()=>{ft(),ht(),gt=e=>{let t=N(),n=0,r=[],i=e||{};try{if((e==null?void 0:e.logSeverityLevel)===void 0)i.logSeverityLevel=2;else if(typeof e.logSeverityLevel!=`number`||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw Error(`log severity level is not valid: ${e.logSeverityLevel}`);if((e==null?void 0:e.logVerbosityLevel)===void 0)i.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!=`number`||!Number.isInteger(e.logVerbosityLevel))throw Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);(e==null?void 0:e.terminate)===void 0&&(i.terminate=!1);let a=0;return(e==null?void 0:e.tag)!==void 0&&(a=pt(e.tag,r)),n=t._OrtCreateRunOptions(i.logSeverityLevel,i.logVerbosityLevel,!!i.terminate,a),n===0&&P(`Can't create run options.`),(e==null?void 0:e.extra)!==void 0&&mt(e.extra,``,new WeakSet,(e,i)=>{let a=pt(e,r),o=pt(i,r);t._OrtAddRunConfigEntry(n,a,o)!==0&&P(`Can't set a run config entry: ${e} - ${i}.`)}),[n,r]}catch(e){throw n!==0&&t._OrtReleaseRunOptions(n),r.forEach(e=>t._free(e)),e}}}),vt,yt,bt,xt,St,Ct,wt=c(()=>{ft(),ht(),vt=e=>{switch(e){case`disabled`:return 0;case`basic`:return 1;case`extended`:return 2;case`layout`:return 3;case`all`:return 99;default:throw Error(`unsupported graph optimization level: ${e}`)}},yt=e=>{switch(e){case`sequential`:return 0;case`parallel`:return 1;default:throw Error(`unsupported execution mode: ${e}`)}},bt=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly=`1`),e.executionProviders&&e.executionProviders.some(e=>(typeof e==`string`?e:e.name)===`webgpu`)&&(e.enableMemPattern=!1)},xt=(e,t,n,r)=>{let i=pt(t,r),a=pt(n,r);N()._OrtAddSessionConfigEntry(e,i,a)!==0&&P(`Can't set a session config entry: ${t} - ${n}.`)},St=async(e,t,n)=>{let r=t.executionProviders;for(let t of r){let r=typeof t==`string`?t:t.name,i=[];switch(r){case`webnn`:if(r=`WEBNN`,xt(e,`session.disable_quant_qdq`,`1`,n),xt(e,`session.disable_qdq_constant_folding`,`1`,n),typeof t!=`string`){let r=t==null?void 0:t.deviceType;r&&xt(e,`deviceType`,r,n)}break;case`webgpu`:if(r=`JS`,typeof t!=`string`){let r=t;if(r!=null&&r.preferredLayout){if(r.preferredLayout!==`NCHW`&&r.preferredLayout!==`NHWC`)throw Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${r.preferredLayout}`);xt(e,`preferredLayout`,r.preferredLayout,n)}}break;case`wasm`:case`cpu`:continue;default:throw Error(`not supported execution provider: ${r}`)}let a=pt(r,n),o=i.length,s=0,c=0;if(o>0){s=N()._malloc(o*N().PTR_SIZE),n.push(s),c=N()._malloc(o*N().PTR_SIZE),n.push(c);for(let e=0;e<o;e++)N().setValue(s+e*N().PTR_SIZE,i[e][0],`*`),N().setValue(c+e*N().PTR_SIZE,i[e][1],`*`)}await N()._OrtAppendExecutionProvider(e,a,s,c,o)!==0&&P(`Can't append execution provider: ${r}.`)}},Ct=async e=>{let t=N(),n=0,r=[],i=e||{};bt(i);try{var a,o,s,c;let e=vt((a=i.graphOptimizationLevel)==null?`all`:a),l=yt((o=i.executionMode)==null?`sequential`:o),u=typeof i.logId==`string`?pt(i.logId,r):0,d=(s=i.logSeverityLevel)==null?2:s;if(!Number.isInteger(d)||d<0||d>4)throw Error(`log severity level is not valid: ${d}`);let f=(c=i.logVerbosityLevel)==null?0:c;if(!Number.isInteger(f)||f<0||f>4)throw Error(`log verbosity level is not valid: ${f}`);let p=typeof i.optimizedModelFilePath==`string`?pt(i.optimizedModelFilePath,r):0;if(n=t._OrtCreateSessionOptions(e,!!i.enableCpuMemArena,!!i.enableMemPattern,l,!!i.enableProfiling,0,u,d,f,p),n===0&&P(`Can't create session options.`),i.executionProviders&&await St(n,i,r),i.enableGraphCapture!==void 0){if(typeof i.enableGraphCapture!=`boolean`)throw Error(`enableGraphCapture must be a boolean value: ${i.enableGraphCapture}`);xt(n,`enableGraphCapture`,i.enableGraphCapture.toString(),r)}if(i.freeDimensionOverrides)for(let[e,a]of Object.entries(i.freeDimensionOverrides)){if(typeof e!=`string`)throw Error(`free dimension override name must be a string: ${e}`);if(typeof a!=`number`||!Number.isInteger(a)||a<0)throw Error(`free dimension override value must be a non-negative integer: ${a}`);let i=pt(e,r);t._OrtAddFreeDimensionOverride(n,i,a)!==0&&P(`Can't set a free dimension override: ${e} - ${a}.`)}return i.extra!==void 0&&mt(i.extra,``,new WeakSet,(e,t)=>{xt(n,e,t,r)}),[n,r]}catch(e){throw n!==0&&t._OrtReleaseSessionOptions(n)!==0&&P(`Can't release session options.`),r.forEach(e=>t._free(e)),e}}}),Tt,F,I,Et,Dt,Ot,kt,At,L=c(()=>{Tt=e=>{switch(e){case`int8`:return 3;case`uint8`:return 2;case`bool`:return 9;case`int16`:return 5;case`uint16`:return 4;case`int32`:return 6;case`uint32`:return 12;case`float16`:return 10;case`float32`:return 1;case`float64`:return 11;case`string`:return 8;case`int64`:return 7;case`uint64`:return 13;case`int4`:return 22;case`uint4`:return 21;default:throw Error(`unsupported data type: ${e}`)}},F=e=>{switch(e){case 3:return`int8`;case 2:return`uint8`;case 9:return`bool`;case 5:return`int16`;case 4:return`uint16`;case 6:return`int32`;case 12:return`uint32`;case 10:return`float16`;case 1:return`float32`;case 11:return`float64`;case 8:return`string`;case 7:return`int64`;case 13:return`uint64`;case 22:return`int4`;case 21:return`uint4`;default:throw Error(`unsupported data type: ${e}`)}},I=(e,t)=>{let n=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],r=typeof t==`number`?t:t.reduce((e,t)=>e*t,1);return n>0?Math.ceil(r*n):void 0},Et=e=>{switch(e){case`float16`:return typeof Float16Array<`u`?Float16Array:Uint16Array;case`float32`:return Float32Array;case`uint8`:return Uint8Array;case`int8`:return Int8Array;case`uint16`:return Uint16Array;case`int16`:return Int16Array;case`int32`:return Int32Array;case`bool`:return Uint8Array;case`float64`:return Float64Array;case`uint32`:return Uint32Array;case`int64`:return BigInt64Array;case`uint64`:return BigUint64Array;default:throw Error(`unsupported type: ${e}`)}},Dt=e=>{switch(e){case`verbose`:return 0;case`info`:return 1;case`warning`:return 2;case`error`:return 3;case`fatal`:return 4;default:throw Error(`unsupported logging level: ${e}`)}},Ot=e=>e===`float32`||e===`float16`||e===`int32`||e===`int64`||e===`uint32`||e===`uint8`||e===`bool`||e===`uint4`||e===`int4`,kt=e=>e===`float32`||e===`float16`||e===`int32`||e===`int64`||e===`uint32`||e===`uint64`||e===`int8`||e===`uint8`||e===`bool`||e===`uint4`||e===`int4`,At=e=>{switch(e){case`none`:return 0;case`cpu`:return 1;case`cpu-pinned`:return 2;case`texture`:return 3;case`gpu-buffer`:return 4;case`ml-tensor`:return 5;default:throw Error(`unsupported data location: ${e}`)}}}),jt,Mt=c(()=>{Ne(),jt=async e=>{if(typeof e==`string`){let t=await fetch(e);if(!t.ok)throw Error(`failed to load external data file: ${e}`);let n=t.headers.get(`Content-Length`),r=n?parseInt(n,10):0;if(r<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw Error(`failed to load external data file: ${e}, no response body.`);let n=t.body.getReader(),i;try{i=new ArrayBuffer(r)}catch(e){if(e instanceof RangeError){let e=Math.ceil(r/65536);i=new WebAssembly.Memory({initial:e,maximum:e}).buffer}else throw e}let a=0;for(;;){let{done:e,value:t}=await n.read();if(e)break;let r=t.byteLength;new Uint8Array(i,a,r).set(t),a+=r}return new Uint8Array(i,0,r)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Nt,Pt,Ft,It,Lt,Rt,R,zt=c(()=>{L(),Nt=[`V`,`I`,`W`,`E`,`F`],Pt=(e,t)=>{console.log(`[${Nt[e]},${new Date().toISOString()}]${t}`)},Lt=(e,t)=>{Ft=e,It=t},Rt=(e,t)=>{let n=Dt(e);n>=Dt(Ft)&&Pt(n,typeof t==`function`?t():t)},R=(...e)=>{It&&Rt(...e)}}),Bt,Vt,z,Ht,Ut,Wt,Gt,B=c(()=>{Bt=class{static calcMatMulShape(e,t){return e[1]===t[0]?[e[0],t[1]]:void 0}},Vt=class{static calcShape(e,t,n=!1){let r=e.length,i=t.length;if(r===0)return t;if(i===0)return e;let a=Math.max(e.length,t.length),o=Array(a);if(n){if(r<2||i<2)return;let n=Bt.calcMatMulShape([e[r-2],e[r-1]],[t[i-2],t[i-1]]);if(n===void 0)return;[o[a-2],o[a-1]]=n}for(let s=n?3:1;s<=a;s++){let n=r-s<0?1:e[r-s],c=i-s<0?1:t[i-s];if(n!==c&&n>1&&c>1)return;let l=Math.max(n,c);if(n&&c)o[a-s]=Math.max(n,c);else{if(l>1)return;o[a-s]=0}}return o}static isValidBroadcast(e,t){let n=e.length,r=t.length;if(n>r)return!1;for(let i=1;i<=n;i++)if(e[n-i]!==1&&e[n-i]!==t[r-i])return!1;return!0}},z=class e{static size(t){return e.getSizeFromDimensionRange(t,0,t.length)}static convertShape(e,t=4){let n=e.length;if(n===0)return[];let r=Array(n),i=n-1;for(;i>=0;){if(e[i]%t===0){r[i]=e[i]/t;break}if(t%e[i]!==0)throw Error(`cannot convert shape`);r[i]=1,t/=e[i],i--}for(i--;i>=0;i--)r[i]=e[i];return r}static sizeFromDimension(t,n){if(n<0||n>t.length)throw Error(`invalid dimension of ${n} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return e.getSizeFromDimensionRange(t,n,t.length)}static sizeToDimension(t,n){if(n<0||n>t.length)throw Error(`invalid dimension of ${n} for sizeToDimension as Tensor has ${t.length} dimensions.`);return e.getSizeFromDimensionRange(t,0,n)}static getSizeFromDimensionRange(e,t,n){let r=1;for(let i=t;i<n;i++){if(e[i]<0)throw Error(`cannot get valid size from specified dimension range. Most likely the range contains negative values in them.`);r*=Number(e[i])}return r}static computeStrides(e){let t=e.length;if(t===0)return[];if(t===1)return[1];let n=Array(t);n[t-1]=1,n[t-2]=e[t-1];for(let r=t-3;r>=0;--r)n[r]=n[r+1]*e[r+1];return n}static normalizeAxis(e,t){if(e<-t&&e>=t)throw Error(`unsupported axis for this operation.`);return e<0?e+t:e}static normalizeAxes(e,t){return e.map(n=>this.normalizeAxis(n,t==null?e.length:t))}static sortBasedOnPerm(e,t){return t?t.map(t=>e[t]):e.slice().reverse()}static padShape(e,t){let n=e.length;return e.map((e,r)=>e+t[r]+t[r+n])}static areEqual(e,t){return e.length===t.length&&e.every((e,n)=>e===t[n])}},Ht=class e{static adjustPoolAttributes(e,t,n,r,i,a){if(!e&&n.length!==t.length-2)throw Error(`length of specified kernel shapes should be 2 less than length of input dimensions`);if(e)for(let e=0;e<t.length-2;e++)e>=n.length?n.push(t[e+2]):n[e]=t[e+2];for(let e=0;e<n.length;e++)if(e<r.length){if(r[e]<0)throw Error(`strides should be greater than or equal to 1`)}else r.push(1);for(let e=0;e<n.length;e++)if(e<i.length){if(i[e]<0)throw Error(`dilations should be greater than or equal to 1`)}else i.push(1);for(let e=0;e<n.length*2;e++)if(e<a.length){if(a[e]<0)throw Error(`pad should be greater than or equal to 1`)}else a.push(0);for(let e=0;e<n.length;e++){if(n[e]<=0)throw Error(`kernel shapes need to be greater than 0`);if(a[e]>=n[e]||a[e+n.length]>=n[e])throw Error(`pads should be smaller than kernel`)}}static adjustPadsBasedOnAutoPad(t,n,r,i,a,o,s){if(s){if(a.length!==2*(t.length-2))throw Error(`length of pads should be twice the length of data dimensions`);if(n.length!==t.length-2)throw Error(`length of strides should be the length of data dimensions`);if(i.length!==t.length-2)throw Error(`length of kernel shapes should be the length of data dimensions`);for(let c=0;c<t.length-2;c++)e.adjustPadAndReturnShape(t[c+(o?1:2)],n[c],r[c],i[c],a,c,c+t.length-2,s)}}static computePoolOutputShape(t,n,r,i,a,o,s){if(n.length<=0)throw Error(`input shape must be of size greater than 0`);let c=[n[0],n[1]];return e.computeShapeHelper(t,n,c,r,i,a,o,s),c}static computeConvOutputShape(t,n,r,i,a,o,s){if(t.length<=0||n.length<=0)throw Error(`invalid input tensor dims or invalid filter tensor dims`);let c=[t[0],n[0]];return e.computeShapeHelper(!1,t,c,r,i,a,o,s),c}static computeShapeHelper(t,n,r,i,a,o,s,c){if(t)for(let e=0;e<n.length-2;e++)r.push(1);else for(let t=0;t<n.length-2;t++)r.push(e.adjustPadAndReturnShape(n[t+2],i[t],a[t],o[t],s,t,t+n.length-2,c))}static adjustPadAndReturnShape(e,t,n,r,i,a,o,s){let c=n*(r-1)+1;if(s&&s!==`NOTSET`)switch(s){case`VALID`:return i[a]=0,i[o]=0,Math.floor((e-c)/t+1);case`SAME_LOWER`:case`SAME_UPPER`:if(n!==1)throw Error(`Dilation not supported for SAME_UPPER or SAME_LOWER`);{let n=((e+t-1)/t-1)*t+r-e;return i[a]=Math.floor(s===`SAME_LOWER`?(n+1)/2:n/2),i[o]=n-i[a],Math.floor((e+n-r)/t+1)}default:throw Error(`Unsupported AutoPad type`)}else return Math.floor((e+i[a]+i[o]-c)/t+1)}},Ut=class{static getShapeOfGemmResult(e,t,n,r,i){if(e.length!==2||n.length!==2)throw Error(`shape need to be of size 2`);let a,o,s;t?(a=e[1],o=e[0]):(a=e[0],o=e[1]);let c=-1;if(r?(s=n[0],c=1):(s=n[1],c=0),n[c]!==o)throw Error(`dimension mismatch`);if(a<=0||s<=0||o<=0)throw Error(`invalid shape specified`);if(i&&!Vt.isValidBroadcast(i,[a,s]))throw Error(`gemm: invalid bias shape for broadcast`);return[a,s,o]}},Wt=-34028234663852886e22,Gt=34028234663852886e22}),Kt,qt=c(()=>{L(),Kt=(e,t)=>new(Et(t))(e)}),Jt,Yt,Xt,Zt,Qt,$t,en,tn,nn,rn,an,on=c(()=>{L(),zt(),Jt=new Map([[`float32`,32],[`float16`,16],[`int32`,32],[`uint32`,32],[`int64`,64],[`uint64`,64],[`int8`,8],[`uint8`,8],[`int4`,4],[`uint4`,4]]),Yt=(e,t)=>{if(t===`int32`)return e;let n=Jt.get(t);if(!n)throw Error(`WebNN backend does not support data type: ${t}`);let r=n/8;if(e.byteLength%r!==0)throw Error(`Invalid Uint8Array length - must be a multiple of ${r}.`);let i=e.byteLength/r,a=new(Et(t))(e.buffer,e.byteOffset,i);switch(t){case`int64`:case`uint64`:{let e=new Int32Array(i);for(let t=0;t<i;t++){let n=a[t];if(n>2147483647n||n<-2147483648n)throw Error(`Can not convert int64 data to int32 - value out of range.`);e[t]=Number(n)}return new Uint8Array(e.buffer)}case`int8`:case`uint8`:case`uint32`:{if(t===`uint32`&&a.some(e=>e>2147483647))throw Error(`Can not convert uint32 data to int32 - value out of range.`);let e=Int32Array.from(a,Number);return new Uint8Array(e.buffer)}default:throw Error(`Unsupported data conversion from ${t} to 'int32'`)}},Xt=(e,t)=>{if(t===`int32`)return e;if(e.byteLength%4!=0)throw Error(`Invalid Uint8Array length - must be a multiple of 4 (int32).`);let n=e.byteLength/4,r=new Int32Array(e.buffer,e.byteOffset,n);switch(t){case`int64`:{let e=BigInt64Array.from(r,BigInt);return new Uint8Array(e.buffer)}case`uint64`:{if(r.some(e=>e<0))throw Error(`Can not convert int32 data to uin64 - negative value found.`);let e=BigUint64Array.from(r,BigInt);return new Uint8Array(e.buffer)}case`int8`:{if(r.some(e=>e<-128||e>127))throw Error(`Can not convert int32 data to int8 - value out of range.`);let e=Int8Array.from(r,Number);return new Uint8Array(e.buffer)}case`uint8`:if(r.some(e=>e<0||e>255))throw Error(`Can not convert int32 data to uint8 - value out of range.`);return Uint8Array.from(r,Number);case`uint32`:{if(r.some(e=>e<0))throw Error(`Can not convert int32 data to uint32 - negative value found.`);let e=Uint32Array.from(r,Number);return new Uint8Array(e.buffer)}default:throw Error(`Unsupported data conversion from 'int32' to ${t}`)}},Zt=1,Qt=()=>Zt++,$t=new Map([[`int8`,`int32`],[`uint8`,`int32`],[`uint32`,`int32`],[`int64`,`int32`]]),en=(e,t)=>{let n=Jt.get(e);if(!n)throw Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((e,t)=>e*t)*n/8):0},tn=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:n,tensor:r,dataType:i,shape:a,fallbackDataType:o}=e;this.sessionId=t,this.mlContext=n,this.mlTensor=r,this.dataType=i,this.tensorShape=a,this.fallbackDataType=o}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return en(this.dataType,this.tensorShape)}destroy(){R(`verbose`,()=>`[WebNN] TensorWrapper.destroy`),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),n=Xt(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(n);return}else return new Uint8Array(n).buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,n){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===n.length&&this.tensorShape.every((e,t)=>e===n[t])}setIsDataConverted(e){this.isDataConverted=e}},nn=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,n,r){let i=this.tensorManager.getMLContext(e),a=this.tensorManager.getMLOpSupportLimits(e),o;if(!(a!=null&&a.input.dataTypes.includes(t))){if(o=$t.get(t),!o||a!=null&&a.input.dataTypes.includes(o))throw Error(`WebNN backend does not support data type: ${t}`);R(`verbose`,()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${o}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(i,t,n))return this.wrapper.tensor;if(r){if(this.wrapper.byteLength!==en(t,n))throw Error(`Unable to copy data to tensor with different size.`);this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let s=typeof MLTensorUsage>`u`?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,n,s,!0,!0,o),r&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType===`int32`)t=Yt(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else R(`verbose`,()=>`Data size does not match tensor size. Releasing tensor.`),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){if(this.activeUpload){var t,n;let r=(t=this.wrapper)!=null&&t.isDataConverted?Xt(this.activeUpload,(n=this.wrapper)==null?void 0:n.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(r):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(r);return}else return r.buffer}if(!this.wrapper)throw Error(`Tensor has not been created.`);return e?this.wrapper.read(e):this.wrapper.read()}},rn=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw Error(`MLContext not found for session.`);return t}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=Qt();return this.tensorTrackersById.set(e,new nn(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,n,r,i){R(`verbose`,()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${n}, shape: ${r}, copyOld: ${i}}`);let a=this.tensorTrackersById.get(t);if(!a)throw Error(`Tensor not found.`);return a.ensureTensor(e,n,r,i)}upload(e,t){let n=this.tensorTrackersById.get(e);if(!n)throw Error(`Tensor not found.`);n.upload(t)}async download(e,t){R(`verbose`,()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t==null?void 0:t.byteLength}}`);let n=this.tensorTrackersById.get(e);if(!n)throw Error(`Tensor not found.`);return n.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,n,r){let i=this.getMLContext(e),a=Qt(),o=new tn({sessionId:e,context:i,tensor:t,dataType:n,shape:r});return this.tensorTrackersById.set(a,new nn(this,o)),this.externalTensors.add(o),a}async getCachedTensor(e,t,n,r,i,a,o){let s=this.getMLContext(e);for(let[r,i]of this.freeTensors.entries())if(i.canReuseTensor(s,t,n)){R(`verbose`,()=>`[WebNN] Reusing tensor {dataType: ${t}, ${o?`fallbackDataType: ${o},`:``} shape: ${n}`);let i=this.freeTensors.splice(r,1)[0];return i.sessionId=e,i}R(`verbose`,()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${o?`fallbackDataType: ${o},`:``} shape: ${n}}`);let c=await s.createTensor({dataType:o==null?t:o,shape:n,dimensions:n,usage:r,writable:i,readable:a});return new tn({sessionId:e,context:s,tensor:c,dataType:t,shape:n,fallbackDataType:o})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},an=(...e)=>new rn(...e)}),sn,cn,ln,un=c(()=>{L(),ft(),qt(),on(),zt(),sn=new Map([[1,`float32`],[10,`float16`],[6,`int32`],[12,`uint32`],[7,`int64`],[13,`uint64`],[22,`int4`],[21,`uint4`],[3,`int8`],[2,`uint8`],[9,`uint8`]]),cn=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let n=Object.keys(e).sort(),r=Object.keys(t).sort();return n.length===r.length&&n.every((n,i)=>n===r[i]&&e[n]===t[n])},ln=class{constructor(e){this.tensorManager=an(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,this.mlOpSupportLimitsBySessionId=new Map,Lt(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw Error(`No active session`);return this.activeSessionId}onRunStart(e){R(`verbose`,()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){R(`verbose`,()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let e of t)R(`verbose`,()=>`[WebNN] releasing temporary tensor {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let t=this.mlContextCache.findIndex(t=>t.gpuDevice===e);if(t!==-1)return this.mlContextCache[t].mlContext;{let t=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:t}),t}}else if(e===void 0){let e=this.mlContextCache.findIndex(e=>e.options===void 0&&e.gpuDevice===void 0);if(e!==-1)return this.mlContextCache[e].mlContext;{let e=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:e}),e}}let t=this.mlContextCache.findIndex(t=>cn(t.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let t=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:t}),t}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let n=this.sessionIdsByMLContext.get(t);n||(n=new Set,this.sessionIdsByMLContext.set(t,n)),n.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,t.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let n=this.sessionIdsByMLContext.get(t);if(n.delete(e),n.size===0){this.sessionIdsByMLContext.delete(t);let e=this.mlContextCache.findIndex(e=>e.mlContext===t);e!==-1&&this.mlContextCache.splice(e,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){R(`verbose`,()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,n,r,i){let a=sn.get(n);if(!a)throw Error(`Unsupported ONNX data type: ${n}`);return this.tensorManager.ensureTensor(e==null?this.currentSessionId:e,t,a,r,i)}async createTemporaryTensor(e,t,n){R(`verbose`,()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${n}}`);let r=sn.get(t);if(!r)throw Error(`Unsupported ONNX data type: ${t}`);let i=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,i,r,n,!1);let a=this.temporarySessionTensorIds.get(e);return a?a.push(i):this.temporarySessionTensorIds.set(e,[i]),i}uploadTensor(e,t){if(!N().shouldTransferToMLTensor)throw Error(`Trying to upload to a MLTensor while shouldTransferToMLTensor is false`);R(`verbose`,()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let n=await this.tensorManager.download(e);return Kt(n,t)}}registerMLTensor(e,t,n,r){let i=sn.get(n);if(!i)throw Error(`Unsupported ONNX data type: ${n}`);let a=this.tensorManager.registerTensor(e,t,i,r);return R(`verbose`,()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${i}, dimensions: ${r}} -> {tensorId: ${a}}`),a}registerMLConstant(e,t,n,r,i,a,o=!1){if(!a)throw Error(`External mounted files are not available.`);let s=e;e.startsWith(`./`)&&(s=e.substring(2));let c=a.get(s);if(!c)throw Error(`File with name ${s} not found in preloaded files.`);if(t+n>c.byteLength)throw Error(`Out of bounds: data offset and length exceed the external file data size.`);let l=c.slice(t,t+n).buffer,u;switch(i.dataType){case`float32`:u=new Float32Array(l);break;case`float16`:u=typeof Float16Array<`u`?new Float16Array(l):new Uint16Array(l);break;case`int32`:u=new Int32Array(l);break;case`uint32`:u=new Uint32Array(l);break;case`int64`:if(o){let e=Yt(new Uint8Array(l),`int64`);u=new Int32Array(e.buffer),i.dataType=`int32`}else u=new BigInt64Array(l);break;case`uint64`:u=new BigUint64Array(l);break;case`int8`:u=new Int8Array(l);break;case`int4`:case`uint4`:case`uint8`:u=new Uint8Array(l);break;default:throw Error(`Unsupported data type: ${i.dataType} in creating WebNN Constant from external data.`)}return R(`verbose`,()=>`[WebNN] registerMLConstant {dataType: ${i.dataType}, shape: ${i.shape}}} ${o?`(Note: it was int64 data type and registered to int32 as workaround)`:``}`),r.constant(i,u)}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let n=this.sessionGraphInputs.get(e);return n?n.includes(t):!1}isGraphOutput(e,t){let n=this.sessionGraphOutputs.get(e);return n?n.includes(t):!1}isGraphInputOutputTypeSupported(e,t,n=!0){let r=sn.get(Tt(t)),i=this.mlOpSupportLimitsBySessionId.get(e);return typeof r>`u`?!1:n?!!(i!=null&&i.input.dataTypes.includes(r)):!!(i!=null&&i.output.dataTypes.includes(r))}flush(){}}}),dn=c(()=>{}),fn,pn,mn,hn,gn,_n,vn,yn,bn,xn=c(()=>{zt(),dn(),fn=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),pn=[],mn=e=>Math.ceil(Number(e)/16)*16,hn=e=>{for(let t=0;t<pn.length;t++){let n=pn[t];if(e<=n)return n}return Math.ceil(e/16)*16},gn=1,_n=()=>gn++,vn=async(e,t,n,r)=>{let i=mn(n),a=e.device.createBuffer({size:i,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let o=e.getCommandEncoder();e.endComputePass(),o.copyBufferToBuffer(t,0,a,0,i),e.flush(),await a.mapAsync(GPUMapMode.READ);let s=a.getMappedRange();if(r){let e=r();return e.set(new Uint8Array(s,0,n)),e}else return new Uint8Array(s.slice(0,n))}finally{a.destroy()}},yn=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[e]of fn)pn.push(e),this.freeBuffers.set(e,[]),this.freeUniformBuffers.set(e,[]);this.sessionCount=0}upload(e,t){let n=t.buffer,r=t.byteOffset,i=t.byteLength,a=mn(i),o=this.storageCache.get(e);if(!o)throw Error(`gpu data for uploading does not exist`);if(Number(o.originalSize)!==i)throw Error(`inconsistent data size. gpu data size=${o.originalSize}, data size=${i}`);let s=this.backend.device.createBuffer({mappedAtCreation:!0,size:a,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),c=s.getMappedRange();new Uint8Array(c).set(new Uint8Array(n,r,i)),s.unmap();let l=this.backend.device.createCommandEncoder();l.copyBufferToBuffer(s,0,o.gpuData.buffer,0,a),this.backend.device.queue.submit([l.finish()]),s.destroy(),R(`verbose`,()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let n=this.storageCache.get(e);if(!n)throw Error(`source gpu data for memcpy does not exist`);let r=this.storageCache.get(t);if(!r)throw Error(`destination gpu data for memcpy does not exist`);if(n.originalSize!==r.originalSize)throw Error(`inconsistent source and destination gpu data size`);let i=mn(n.originalSize),a=this.backend.getCommandEncoder();this.backend.endComputePass(),a.copyBufferToBuffer(n.gpuData.buffer,0,r.gpuData.buffer,0,i)}registerExternalBuffer(e,t,n){let r;if(n){if(r=n[0],e===n[1])return R(`verbose`,()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${r}, buffer is the same, skip.`),r;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else r=_n();return this.storageCache.set(r,{gpuData:{id:r,type:0,buffer:e},originalSize:t}),R(`verbose`,()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${r}, registered.`),r}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),R(`verbose`,()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let n=hn(e),r,i=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,a=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(i||a){let e=(i?this.freeBuffers:this.freeUniformBuffers).get(n);r=e&&e.length>0?e.pop():this.backend.device.createBuffer({size:n,usage:t})}else r=this.backend.device.createBuffer({size:n,usage:t});let o={id:_n(),type:0,buffer:r};return this.storageCache.set(o.id,{gpuData:o,originalSize:Number(e)}),R(`verbose`,()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${o.id}`),o}get(e){var t;return(t=this.storageCache.get(e))==null?void 0:t.gpuData}release(e){let t=typeof e==`bigint`?Number(e):e,n=this.storageCache.get(t);if(!n){if(this.storageCache.size===0)return 0;throw Error(`releasing data does not exist`)}return R(`verbose`,()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${n.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(n.gpuData.buffer),n.originalSize}async download(e,t){let n=this.storageCache.get(Number(e));if(!n)throw Error(`data does not exist`);await vn(this.backend,n.gpuData.buffer,n.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=fn.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let n=this.freeBuffers.get(e.size)||[];t===void 0||n.length>=t?e.destroy():n.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let n=this.freeUniformBuffers.get(e.size)||[];t===void 0||n.length>=t?e.destroy():n.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(e=>{e.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(e=>{e.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(e=>{e.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(e=>{e.destroy()}),this.capturedPendingBuffers.delete(e)),--this.sessionCount,this.sessionCount===0&&(R(`warning`,()=>`[WebGPU] Clearing webgpu buffer cache`),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.storageCache=new Map)}},bn=(...e)=>new yn(...e)}),Sn,V,H=c(()=>{Sn=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(`;`)),this.key}},V=e=>new Sn(e)}),Cn,wn,U,Tn,W,G,En,Dn,On,K,kn,q,J,An,jn,Mn,Nn,Y=c(()=>{L(),B(),Cn=64,wn=(e,t)=>{if(t===3)throw Error(`vec3 has same alignment as vec4, use vec4 instead`);switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:`f16`;case 1:return t>1?`vec${t}<f32>`:`f32`;case 6:return t>1?`vec${t}<i32>`:`i32`;case 12:return t>1?`vec${t}<u32>`:`u32`;case 7:if(t>1)throw Error(`currently not supported vecX of uint64 yet`);return[`vec2<u32>`,`i32`];case 13:if(t>1)throw Error(`currently not supported vecX of uint64 yet`);return[`vec2<u32>`,`u32`];case 9:if(t!==4)throw Error(`bool must be vec4`);return[`u32`,`vec4<bool>`];case 22:return`i32`;case 21:return`u32`;default:throw Error(`Unknown data type: ${e}`)}},U=(e,t=1)=>{let n=wn(e,t);return typeof n==`string`?n:n[0]},Tn=(e,t=1)=>{let n=wn(e,t);return typeof n==`string`?n:n[1]},W=(...e)=>{let t=[];return e.forEach(e=>{e.length!==0&&t.push({type:12,data:e},{type:12,data:z.computeStrides(e)})}),t},G=e=>e%4==0?4:e%2==0?2:1,En=(e=`f32`,t,n=`0`)=>!t||t===1?`${e}(${n})`:`vec${t}<${e}>(${n})`,Dn=(e,t,n)=>e===`f32`?n:t===1?`f32(${n})`:`vec${t}<f32>(${n})`,On=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,K=(e,t,n,r)=>e.startsWith(`uniforms.`)&&n>4?typeof t==`string`?r===`f16`?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:r===`f16`?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:n>1?`${e}[${t}]`:e,kn=(e,t,n,r,i)=>{let a=typeof n==`number`,o=a?n:n.length,s=[...Array(o).keys()],c=o<2?`u32`:o<=4?`vec${o}<u32>`:`array<u32, ${o}>`,l=wn(t,i),u=typeof l==`string`?l:l[1],d={indices:c,value:u,storage:typeof l==`string`?l:l[0],tensor:t},f=e=>typeof e==`string`?e:`${e}u`,p={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},m=a?`uniforms.`:``,h=`${m}${e}_shape`,g=`${m}${e}_strides`,_=``;for(let e=0;e<o-1;e++)_+=`
    let dim${e} = current / ${K(g,e,o)};
    let rest${e} = current % ${K(g,e,o)};
    indices[${e}] = dim${e};
    current = rest${e};
    `;_+=`indices[${o-1}] = current;`;let v=o<2?``:`
  fn o2i_${e}(offset: u32) -> ${d.indices} {
    var indices: ${d.indices};
    var current = offset;
    ${_}
    return indices;
  }`,y=t=>(p.offsetToIndices=!0,o<2?t:`o2i_${e}(${t})`),b=[];if(o>=2)for(let e=o-1;e>=0;e--)b.push(`${K(g,e,o)} * (indices[${e}])`);let x=o<2?``:`
  fn i2o_${e}(indices: ${d.indices}) -> u32 {
    return ${b.join(`+`)};
  }`,S=t=>(p.indicesToOffset=!0,o<2?t:`i2o_${e}(${t})`),C=(...e)=>o===0?`0u`:`${d.indices}(${e.map(f).join(`,`)})`,w=(e,t)=>o<2?`${e}`:`${K(e,t,o)}`,T=(e,t,n)=>o<2?`${e}=${n};`:`${K(e,t,o)}=${n};`,ee={},E=(t,n)=>{p.broadcastedIndicesToOffset=!0;let r=`${n.name}broadcastedIndicesTo${e}Offset`;if(r in ee)return`${r}(${t})`;let i=[];for(let e=o-1;e>=0;e--){let t=n.indicesGet(`outputIndices`,e+n.rank-o);i.push(`${w(g,e)} * (${t} % ${w(h,e)})`)}return ee[r]=`fn ${r}(outputIndices: ${n.type.indices}) -> u32 {
             return ${i.length>0?i.join(`+`):`0u`};
           }`,`${r}(${t})`},te=(t,n)=>(()=>{if(d.storage===d.value)return`${e}[${t}]=${n};`;if(d.storage===`vec2<u32>`&&d.value===`i32`)return`${e}[${t}]=vec2<u32>(u32(${n}), select(0u, 0xFFFFFFFFu, ${n} < 0));`;if(d.storage===`vec2<u32>`&&d.value===`u32`)return`${e}[${t}]=vec2<u32>(u32(${n}), 0u);`;if(d.storage===`u32`&&d.value===`vec4<bool>`)return`${e}[${t}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${n}));`;throw Error(`not supported combination of storage type ${d.storage} and value type ${d.value} yet`)})(),D=t=>(()=>{if(d.storage===d.value)return`${e}[${t}]`;if(d.storage===`vec2<u32>`&&d.value===`i32`)return`i32(${e}[${t}].x)`;if(d.storage===`vec2<u32>`&&d.value===`u32`)return`u32(${e}[${t}].x)`;if(d.storage===`u32`&&d.value===`vec4<bool>`)return`vec4<bool>(bool(${e}[${t}] & 0xFFu), bool(${e}[${t}] & 0xFF00u), bool(${e}[${t}] & 0xFF0000u), bool(${e}[${t}] & 0xFF000000u))`;throw Error(`not supported combination of storage type ${d.storage} and value type ${d.value} yet`)})(),O=o<2?``:`
  fn get_${e}ByIndices(indices: ${d.indices}) -> ${u} {
    return ${D(`i2o_${e}(indices)`)};
  }`,ne=o<2?``:(()=>{let t=s.map(e=>`d${e}: u32`).join(`, `),n=s.map(e=>`d${e}`).join(`, `);return`
  fn get_${e}(${t}) -> ${u} {
    return get_${e}ByIndices(${C(n)});
  }`})(),re=(...t)=>{if(t.length!==o)throw Error(`indices length must be ${o}`);let n=t.map(f).join(`,`);return o===0?D(`0u`):o===1?D(n[0]):(p.get=!0,p.getByIndices=!0,p.indicesToOffset=!0,`get_${e}(${n})`)},k=t=>o<2?D(t):(p.getByIndices=!0,p.indicesToOffset=!0,`get_${e}ByIndices(${t})`),A=o<2?``:`
  fn set_${e}ByIndices(indices: ${d.indices}, value: ${u}) {
    ${te(`i2o_${e}(indices)`,`value`)}
  }`,ie=o<2?``:(()=>{let t=s.map(e=>`d${e}: u32`).join(`, `),n=s.map(e=>`d${e}`).join(`, `);return`
  fn set_${e}(${t}, value: ${u}) {
    set_${e}ByIndices(${C(n)}, value);
  }`})();return{impl:()=>{let e=[],t=!1;return p.offsetToIndices&&(e.push(v),t=!0),p.indicesToOffset&&(e.push(x),t=!0),p.broadcastedIndicesToOffset&&(Object.values(ee).forEach(t=>e.push(t)),t=!0),p.set&&(e.push(ie),t=!0),p.setByIndices&&(e.push(A),t=!0),p.get&&(e.push(ne),t=!0),p.getByIndices&&(e.push(O),t=!0),!a&&t&&e.unshift(`const ${h} = ${d.indices}(${n.join(`,`)});`,`const ${g} = ${d.indices}(${z.computeStrides(n).join(`,`)});`),e.join(`
`)},type:d,offsetToIndices:y,indicesToOffset:S,broadcastedIndicesToOffset:E,indices:C,indicesGet:w,indicesSet:T,set:(...t)=>{if(t.length!==o+1)throw Error(`indices length must be ${o}`);let n=t[o];if(typeof n!=`string`)throw Error(`value must be string`);let r=t.slice(0,o).map(f).join(`,`);return o===0?te(`0u`,n):o===1?te(r[0],n):(p.set=!0,p.setByIndices=!0,p.indicesToOffset=!0,`set_${e}(${r}, ${n})`)},setByOffset:te,setByIndices:(t,n)=>o<2?te(t,n):(p.setByIndices=!0,p.indicesToOffset=!0,`set_${e}ByIndices(${t}, ${n});`),get:re,getByOffset:D,getByIndices:k,usage:r,name:e,strides:g,shape:h,rank:o}},q=(e,t,n,r=1)=>kn(e,t,n,`input`,r),J=(e,t,n,r=1)=>kn(e,t,n,`output`,r),An=(e,t,n)=>kn(e,t,n,`atomicOutput`,1),jn=(e,t,n,r=1)=>kn(e,t,n,`internal`,r),Mn=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e==`number`?`${e}u`:e}) { return; }`}mainStart(e=Cn){let t=typeof e==`number`?e:e[0],n=typeof e==`number`?1:e[1],r=typeof e==`number`?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||n>this.limits.maxComputeWorkgroupSizeY||r>this.limits.maxComputeWorkgroupSizeZ)throw Error(`workgroup size [${t}, ${n}, ${r}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*n*r>this.limits.maxComputeInvocationsPerWorkgroup)throw Error(`workgroup size [${t}, ${n}, ${r}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let i=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1;return`@compute @workgroup_size(${t}, ${n}, ${r})
  fn main(${i?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`}) {
    ${i?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*n*r}u + local_idx;`}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith(`uniforms.`)&&this.uniforms.push({name:e.shape.replace(`uniforms.`,``),type:`u32`,length:e.rank}),e.strides.startsWith(`uniforms.`)&&this.uniforms.push({name:e.strides.replace(`uniforms.`,``),type:`u32`,length:e.rank}))}declareVariable(e,t){if(e.usage===`internal`)throw Error(`cannot use internal variable with declareVariable(). use registerInternalVariables() instead.`);this.variables.push(e),this.appendVariableUniforms(e);let n=e.usage===`input`?`read`:`read_write`,r=e.usage===`atomicOutput`?`atomic<i32>`:e.type.storage;return`@group(0) @binding(${t}) var<storage, ${n}> ${e.name}: array<${r}>;`}declareVariables(...e){return e.map(e=>this.declareVariable(e,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!==`internal`)throw Error(`cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.`);this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(e=>this.registerInternalVariable(e)),this}registerUniform(e,t,n=1){return this.uniforms.push({name:e,type:t,length:n}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return``;let e=[];for(let{name:t,type:n,length:r}of this.uniforms)if(r&&r>4)n===`f16`?e.push(`@align(16) ${t}:array<mat2x4<${n}>, ${Math.ceil(r/8)}>`):e.push(`${t}:array<vec4<${n}>, ${Math.ceil(r/4)}>`);else{let i=r==null||r===1?n:`vec${r}<${n}>`;e.push(`${t}:${i}`)}return`
      struct Uniforms { ${e.join(`, `)} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=e=>[12,10,1,6][[`u32`,`f16`,`f32`,`i32`].indexOf(e)];return this.uniforms.map(t=>{var n;return[e(t.type),(n=t.length)==null?1:n]})}},Nn=(e,t)=>new Mn(e,t)}),Pn,Fn,In,Ln,Rn,zn,Bn,Vn,Hn,Un=c(()=>{L(),B(),H(),Y(),Pn=(e,t)=>{if(!e||e.length!==1)throw Error(`Transpose requires 1 input.`);if(t.length!==0&&t.length!==e[0].dims.length)throw Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Fn=(e,t)=>t.length===0?[...Array(e).keys()].reverse():t,In=(e,t)=>z.sortBasedOnPerm(e,Fn(e.length,t)),Ln=(e,t,n,r)=>{let i=`fn perm(i: ${r.type.indices}) -> ${n.type.indices} {
    var a: ${n.type.indices};`;for(let n=0;n<t;++n)i+=`a[${e[n]}]=i[${n}];`;return i+=`return a;}`},Rn=(e,t)=>{let n=[],r=[];for(let i=0;i<e.length;++i)e[i]!==1&&n.push(e[i]),e[t[i]]!==1&&r.push(t[i]);return{newShape:n,newPerm:r}},zn=(e,t)=>{let n=0;for(let r=0;r<e.length;++r)if(t[e[r]]!==1){if(e[r]<n)return!1;n=e[r]}return!0},Bn=(e,t)=>{let n=e.dataType,r=e.dims.length,i=Fn(r,t),a=In(e.dims,i),o=e.dims,s=a,c=r<2||zn(i,e.dims),l;if(c)return l=e=>{let t=q(`input`,n,o,4),r=J(`output`,n,s,4);return`
  ${e.registerUniform(`output_size`,`u32`).declareVariables(t,r)}
  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
    output[global_idx] = input[global_idx];
  }`},{name:`TransposeCopy`,shaderCache:{inputDependencies:[`type`]},getRunData:()=>{let t=z.size(a);return{outputs:[{dims:a,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(t/64/4)},programUniforms:[{type:12,data:Math.ceil(t/4)}]}},getShaderSource:l};let{newShape:u,newPerm:d}=Rn(e.dims,i),f=z.areEqual(d,[2,3,1]),p=z.areEqual(d,[3,1,2]);return u.length===2||f||p?(o=f?[u[0],u[1]*u[2]]:p?[u[0]*u[1],u[2]]:u,s=[o[1],o[0]],l=e=>{let t=q(`a`,n,o.length),r=J(`output`,n,s.length);return`
  ${e.registerUniform(`output_size`,`u32`).declareVariables(t,r)}
  var<workgroup> tile : array<array<${r.type.value}, 17>, 16>;
  ${e.mainStart([16,16,1])}
    let stride = (uniforms.output_shape[1] - 1) / 16 + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * 16u + local_id.x;
    let input_row = workgroup_id_x * 16u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${t.getByIndices(`${t.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * 16u + local_id.x;
    let output_row = workgroup_id_y * 16u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${r.setByIndices(`${r.type.indices}(output_row, output_col)`,`tile[local_id.x][local_id.y]`)}
    }
  }`},{name:`TransposeShared`,shaderCache:{inputDependencies:[`type`]},getRunData:()=>{let t=z.size(a);return{outputs:[{dims:a,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(s[1]/16),y:Math.ceil(s[0]/16)},programUniforms:[{type:12,data:t},...W(o,s)]}},getShaderSource:l}):(l=e=>{let t=q(`a`,n,o.length),a=J(`output`,n,s.length);return`
  ${e.registerUniform(`output_size`,`u32`).declareVariables(t,a)}

  ${Ln(i,r,t,a)}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}

    let indices = ${a.offsetToIndices(`global_idx`)};
    let aIndices = perm(indices);

    ${a.setByOffset(`global_idx`,t.getByIndices(`aIndices`))}
  }`},{name:`Transpose`,shaderCache:{hint:`${t}`,inputDependencies:[`rank`]},getRunData:()=>{let t=z.size(a);return{outputs:[{dims:a,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(t/64)},programUniforms:[{type:12,data:t},...W(o,s)]}},getShaderSource:l})},Vn=(e,t)=>{Pn(e.inputs,t.perm),e.compute(Bn(e.inputs[0],t.perm))},Hn=e=>V({perm:e.perm})}),Wn,Gn,Kn,qn,Jn,Yn,Xn,Zn,Qn,$n,er,tr,nr,rr,ir,ar,or,sr,cr,lr,ur,dr=c(()=>{L(),B(),Y(),Fr(),Un(),Wn={max:`select(bestValue, candidate, candidate > bestValue)`,min:`select(bestValue, candidate, candidate < bestValue)`,mean:`bestValue + candidate`,sum:`bestValue + candidate`,prod:`bestValue * candidate`,sumSquare:`bestValue + candidate * candidate`,logSumExp:`bestValue + exp(candidate)`,l1:`bestValue + abs(candidate)`,l2:`bestValue + candidate * candidate`,logSum:`bestValue + candidate`},Gn={max:`select(bestValue, candidate, candidate > bestValue)`,min:`select(bestValue, candidate, candidate < bestValue)`,mean:`bestValue + candidate`,sum:`bestValue + candidate`,prod:`bestValue * candidate`,sumSquare:`bestValue + candidate`,logSumExp:`bestValue + candidate`,l1:`bestValue + candidate`,l2:`bestValue + candidate`,logSum:`bestValue + candidate`},Kn={max:`_A[offset]`,min:`_A[offset]`,mean:`0`,sum:`0`,prod:`1`,sumSquare:`0`,logSumExp:`0`,l1:`0`,l2:`0`,logSum:`0`},qn={max:`bestValue`,min:`bestValue`,sum:`bestValue`,prod:`bestValue`,sumSquare:`bestValue`,logSumExp:`log(bestValue)`,l1:`bestValue`,l2:`sqrt(bestValue)`,logSum:`log(bestValue)`},Jn=(e,t)=>{let n=[];for(let r=t-e;r<t;++r)n.push(r);return n},Yn=(e,t)=>{let n=[],r=e.length;for(let i=0;i<r;i++)t.indexOf(i)===-1&&n.push(e[i]);return[n,t.map(t=>e[t])]},Xn=(e,t)=>{let n=e.length+t.length,r=[],i=0;for(let a=0;a<n;a++)t.indexOf(a)===-1?r.push(e[i++]):r.push(1);return r},Zn=(e,t)=>{for(let n=0;n<e.length;++n)if(e[e.length-n-1]!==t-1-n)return!1;return!0},Qn=(e,t)=>{let n=[];if(!Zn(e,t)){for(let r=0;r<t;++r)e.indexOf(r)===-1&&n.push(r);e.forEach(e=>n.push(e))}return n},$n=(e,t,n,r,i,a,o)=>{let s=n[0].dims,c=z.size(a),l=z.size(o),u=q(`_A`,n[0].dataType,s),d=J(`output`,i,a),f=64;c===1&&(f=256);let p=`
          var<workgroup> aBestValues : array<f32, ${f}>;
       `;return{name:e,shaderCache:{hint:`${t};${f}`,inputDependencies:[`type`]},getShaderSource:e=>`
        ${e.registerUniform(`reduceSize`,`u32`).declareVariables(u,d)}
        ${p}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${e.mainStart(f)}

          let outputIndex = global_idx / ${f};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${Kn[r]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${f}) {
           let candidate = f32(${u.getByOffset(`offset + k`)});
           bestValue = ${Wn[r]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${f}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${Gn[r]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${d.setByOffset(`outputIndex`,`${r===`mean`?`${d.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${d.type.storage}(${qn[r]})`}`)};
         }
        }`,getRunData:()=>({outputs:[{dims:a,dataType:i}],dispatchGroup:{x:c},programUniforms:[{type:12,data:l}]})}},er=(e,t,n,r)=>{let i=e.inputs.length===1?n:hr(e.inputs,n),a=i.axes;a.length===0&&!i.noopWithEmptyAxes&&(a=e.inputs[0].dims.map((e,t)=>t));let o=z.normalizeAxes(a,e.inputs[0].dims.length),s=o,c=e.inputs[0],l=Qn(s,e.inputs[0].dims.length);l.length>0&&(c=e.compute(Bn(e.inputs[0],l),{inputs:[0],outputs:[-1]})[0],s=Jn(s.length,c.dims.length));let[u,d]=Yn(c.dims,s),f=u;i.keepDims&&(f=Xn(u,o)),e.compute($n(t,i.cacheKey,[c],r,e.inputs[0].dataType,f,d),{inputs:[c]})},tr=(e,t)=>{er(e,`ReduceMeanShared`,t,`mean`)},nr=(e,t)=>{er(e,`ReduceL1Shared`,t,`l1`)},rr=(e,t)=>{er(e,`ReduceL2Shared`,t,`l2`)},ir=(e,t)=>{er(e,`ReduceLogSumExpShared`,t,`logSumExp`)},ar=(e,t)=>{er(e,`ReduceMaxShared`,t,`max`)},or=(e,t)=>{er(e,`ReduceMinShared`,t,`min`)},sr=(e,t)=>{er(e,`ReduceProdShared`,t,`prod`)},cr=(e,t)=>{er(e,`ReduceSumShared`,t,`sum`)},lr=(e,t)=>{er(e,`ReduceSumSquareShared`,t,`sumSquare`)},ur=(e,t)=>{er(e,`ReduceLogSumShared`,t,`logSum`)}}),fr,pr,mr,hr,gr,_r,vr,yr,br,xr,Sr,Cr,X,wr,Tr,Z,Er,Q,Dr,Or,kr,Ar,jr,Mr,Nr,Pr,Fr=c(()=>{L(),B(),H(),Y(),dr(),fr=e=>{if(!e||e.length===0||e.length>2)throw Error(`Reduce op requires 1 or 2 inputs.`);if(e.length===2&&e[1].dims.length!==1)throw Error(`Invalid axes input dims.`)},pr=e=>[``,``,`var value = ${e.getByIndices(`input_indices`)};`,``],mr=(e,t,n,r,i,a,o=!1,s=!1)=>{let c=[],l=n[0].dims,u=l.length,d=z.normalizeAxes(i,u),f=!s&&d.length===0;l.forEach((e,t)=>{f||d.indexOf(t)>=0?o&&c.push(1):c.push(e)});let p=c.length,m=z.size(c);return{name:e,shaderCache:t,getShaderSource:e=>{let t=[],i=q(`_A`,n[0].dataType,u),s=J(`output`,a,p),c=r(i,s,d),m=c[2];for(let e=0,n=0;e<u;e++)f||d.indexOf(e)>=0?(o&&n++,m=`for(var j${e}: u32 = 0; j${e} < ${l[e]}; j${e}++) {
                  ${c[2].includes(`last_index`)?`let last_index = j${e};`:``}
                  ${i.indicesSet(`input_indices`,e,`j${e}`)}
                  ${m}
                }`):(t.push(`${i.indicesSet(`input_indices`,e,s.indicesGet(`output_indices`,n))};`),n++);return`

        ${e.registerUniform(`output_size`,`u32`).declareVariables(i,s)}

        ${e.mainStart()}
          ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
          var input_indices: ${i.type.indices};
          let output_indices = ${s.offsetToIndices(`global_idx`)};

          ${t.join(`
`)}
          ${c[0]}       // init ops for reduce max/min
          ${c[1]}
          ${m}
          ${c[3]}
          ${c.length===4?s.setByOffset(`global_idx`,`value`):c.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:c,dataType:a}],dispatchGroup:{x:Math.ceil(m/64)},programUniforms:[{type:12,data:m},...W(l,c)]})}},hr=(e,t)=>{let n=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(e=>n.push(Number(e))),V({axes:n,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},gr=(e,t,n,r)=>{let i=e.inputs,a=i.length===1?n:hr(i,n);e.compute(mr(t,{hint:a.cacheKey,inputDependencies:[`rank`]},[i[0]],a.noopWithEmptyAxes&&a.axes.length===0?pr:r,a.axes,i[0].dataType,a.keepDims,a.noopWithEmptyAxes),{inputs:[0]})},_r=(e,t)=>{fr(e.inputs),gr(e,`ReduceLogSum`,t,(e,t)=>[`var value = ${t.type.storage}(0);`,``,`value += ${e.getByIndices(`input_indices`)};`,`value = log(value);`])},vr=(e,t)=>{fr(e.inputs),gr(e,`ReduceL1`,t,(e,t)=>[`var value = ${t.type.storage}(0);`,``,`value += abs(${e.getByIndices(`input_indices`)});`,``])},yr=(e,t)=>{fr(e.inputs),gr(e,`ReduceL2`,t,(e,t)=>[`var t = ${t.type.value}(0); var value = ${t.type.value}(0);`,``,`t = ${e.getByIndices(`input_indices`)}; value += (t * t);`,`value = sqrt(value);`])},br=(e,t)=>{fr(e.inputs),gr(e,`ReduceLogSumExp`,t,(e,t)=>[`var value = ${t.type.storage}(0);`,``,`value += exp(${e.getByIndices(`input_indices`)});`,`value = log(value);`])},xr=(e,t)=>{fr(e.inputs),gr(e,`ReduceMax`,t,(e,t,n)=>{let r=[];for(let t=0;t<e.rank;t++)(n.indexOf(t)>=0||n.length===0)&&r.push(e.indicesSet(`input_indices`,t,0));return[`${r.join(`
`)}`,`var value = ${e.getByIndices(`input_indices`)};`,`value = max(value, ${e.getByIndices(`input_indices`)});`,``]})},Sr=(e,t)=>{fr(e.inputs),gr(e,`ReduceMean`,t,(t,n,r)=>{let i=1;for(let n=0;n<t.rank;n++)(r.indexOf(n)>=0||r.length===0)&&(i*=e.inputs[0].dims[n]);return[`var sum = f32(0);`,``,`sum += f32(${t.getByIndices(`input_indices`)});`,`let value = ${n.type.value}(sum / ${i});`]})},Cr=(e,t)=>{fr(e.inputs),gr(e,`ReduceMin`,t,(e,t,n)=>{let r=[];for(let t=0;t<e.rank;t++)(n.indexOf(t)>=0||n.length===0)&&r.push(`input_indices[${t}] = 0;`);return[`${r.join(`
`)}`,`var value = ${e.getByIndices(`input_indices`)};`,`value = min(value, ${e.getByIndices(`input_indices`)});`,``]})},X=(e,t)=>{fr(e.inputs),gr(e,`ReduceProd`,t,(e,t)=>[`var value = ${t.type.storage}(1);`,``,`value *= ${e.getByIndices(`input_indices`)};`,``])},wr=(e,t)=>{fr(e.inputs),gr(e,`ReduceSum`,t,(e,t)=>[`var value = ${t.type.storage}(0);`,``,`value += ${e.getByIndices(`input_indices`)};`,``])},Tr=(e,t)=>{fr(e.inputs),gr(e,`ReduceSumSquare`,t,(e,t)=>[`var t = ${t.type.value}(0); var value = ${t.type.value}(0);`,``,`t = ${e.getByIndices(`input_indices`)}; value += t * t;`,``])},Z=(e,t,n)=>{if(t.length===0)return n;let r=1,i=1;for(let n=0;n<t.length;n++)t.indexOf(n)===-1?r*=e[n]:i*=e[n];return i<32&&r>1024},Er=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Sr(e,t):tr(e,t)},Q=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?vr(e,t):nr(e,t)},Dr=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?yr(e,t):rr(e,t)},Or=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?br(e,t):ir(e,t)},kr=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?xr(e,t):ar(e,t)},Ar=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Cr(e,t):or(e,t)},jr=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?X(e,t):sr(e,t)},Mr=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?wr(e,t):cr(e,t)},Nr=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Tr(e,t):lr(e,t)},Pr=(e,t)=>{Z(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?_r(e,t):ur(e,t)}}),Ir,Lr,Rr,zr,Br=c(()=>{L(),H(),Fr(),Ir=e=>{if(!e||e.length===0||e.length>2)throw Error(`ArgMinMaxOp op requires 1 or 2 inputs.`);if(e[0].dataType!==1)throw Error(`Invalid input type.`)},Lr=(e,t)=>{Ir(e.inputs),e.compute(mr(`ArgMin`,{hint:t.cacheKey,inputDependencies:[`rank`]},[e.inputs[0]],(e,n,r)=>{let i=[];for(let t=0;t<e.rank;t++)(r.indexOf(t)>=0||r.length===0)&&i.push(`input_indices[${t}] = 0;`);return[`${i.join(`
`)}`,`var value = ${e.getByIndices(`input_indices`)};
var best_index : i32 = 0;`,`if (${e.getByIndices(`input_indices`)} ${t.selectLastIndex>0?`<=`:`<`} value) {
         value = ${e.getByIndices(`input_indices`)};
         best_index = i32(last_index);
       }`,``,n.setByOffset(`global_idx`,`best_index`)]},[t.axis],7,t.keepDims),{inputs:[0]})},Rr=(e,t)=>{Ir(e.inputs),e.compute(mr(`argMax`,{hint:t.cacheKey,inputDependencies:[`rank`]},[e.inputs[0]],(e,n,r)=>{let i=[];for(let t=0;t<e.rank;t++)(r.indexOf(t)>=0||r.length===0)&&i.push(`input_indices[${t}] = 0;`);return[`${i.join(`
`)}`,`var value = ${e.getByIndices(`input_indices`)};
var best_index : i32 = 0;`,`if (${e.getByIndices(`input_indices`)} ${t.selectLastIndex>0?`>=`:`>`} value) {
         value = ${e.getByIndices(`input_indices`)};
         best_index = i32(last_index);
       }`,``,n.setByOffset(`global_idx`,`best_index`)]},[t.axis],7,t.keepDims),{inputs:[0]})},zr=e=>V(e)}),Vr,Hr,Ur,Wr,Gr,Kr,qr,Jr,Yr=c(()=>{L(),B(),dn(),Y(),Vr=(e,t)=>{let n=e[0],r=e[1],i=e[2],a=e[3],o=e[4],s=e[5];if(o&&s)throw Error(`Attention cannot have both past and attention_bias`);if(n.dims.length!==3)throw Error(`Input "input" must have 3 dimensions`);let c=n.dims[0],l=n.dims[1],u=n.dims[2];if(i.dims.length!==1)throw Error(`Input "bias" is expected to have 1 dimensions`);if(r.dims.length!==2)throw Error(`Input "weights" is expected to have 2 dimensions`);if(r.dims[0]!==u)throw Error(`Input 1 dimension 0 should have same length as dimension 2 of input 0`);if(i.dims[0]!==r.dims[1])throw Error(`Input "bias" dimension 0 should have same length as dimension 1 of input "weights"`);let d=i.dims[0]/3,f=d,p=f;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw Error(`qkv_hidden_sizes attribute should have 3 elements`);for(let e of t.qkvHiddenSizes)if(e%t.numHeads!==0)throw Error(`qkv_hidden_sizes should be divisible by num_heads`);d=t.qkvHiddenSizes[0],f=t.qkvHiddenSizes[1],p=t.qkvHiddenSizes[2]}let m=l;if(d!==f)throw Error(`qkv_hidden_sizes first element should be same as the second`);if(i.dims[0]!==d+f+p)throw Error(`Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes`);let h=0;if(o){if(f!==p)throw Error(`Input "past" expect k_hidden_size == v_hidden_size`);if(o.dims.length!==5)throw Error(`Input "past" must have 5 dimensions`);if(o.dims[0]!==2)throw Error(`Input "past" first dimension must be 2`);if(o.dims[1]!==c)throw Error(`Input "past" second dimension must be batch_size`);if(o.dims[2]!==t.numHeads)throw Error(`Input "past" third dimension must be num_heads`);if(o.dims[4]!==f/t.numHeads)throw Error(`Input "past" fifth dimension must be k_hidden_size / num_heads`);t.pastPresentShareBuffer||(h=o.dims[3])}let g=m+h;if(a)throw Error(`Mask not supported`);if(o)throw Error(`past is not supported`);if(s){if(s.dims.length!==4)throw Error(`Input "attention_bias" must have 4 dimensions`);if(s.dims[0]!==c||s.dims[1]!==t.numHeads||s.dims[2]!==l||s.dims[3]!==g)throw Error(`Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)`)}return{batchSize:c,sequenceLength:l,pastSequenceLength:h,kvSequenceLength:m,totalSequenceLength:g,maxSequenceLength:-1,inputHiddenSize:u,hiddenSize:d,vHiddenSize:p,headSize:Math.floor(d/t.numHeads),vHeadSize:Math.floor(p/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:0,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},Hr=(e,t,n)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset(`0`)});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e==null?void 0:e.getByOffset(`batchIdx`)}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${n?`let past_sequence_length = uniforms.past_sequence_length`:``};
    let present_sequence_length = total_sequence_length;
    `,Ur=(e,t,n,r,i,a,o,s)=>{let c=G(o?1:a),l=64,u=a/c;u<l&&(l=32);let d=Math.ceil(a/c/l),f=[{type:12,data:t},{type:12,data:n},{type:12,data:r},{type:12,data:i},{type:12,data:u},{type:12,data:d}],p=U(e.dataType,c),m=Tn(1,c),h=[`type`];return o&&h.push(`type`),s&&h.push(`type`),{name:`AttentionProbsSoftmax`,shaderCache:{hint:`${l};${p};${c}`,inputDependencies:h},getShaderSource:t=>{let n=J(`x`,e.dataType,e.dims,c),r=[n],i=o?q(`seq_lens`,o.dataType,o.dims):void 0;i&&r.push(i);let a=s?q(`total_sequence_length_input`,s.dataType,s.dims):void 0;a&&r.push(a);let u=Tn(e.dataType);return`
  var<workgroup> thread_max: array<f32, ${l}>;
  var<workgroup> thread_sum: array<f32, ${l}>;
  ${t.registerUniforms([{name:`batch_size`,type:`u32`},{name:`num_heads`,type:`u32`},{name:`past_sequence_length`,type:`u32`},{name:`sequence_length`,type:`u32`},{name:`total_sequence_length`,type:`u32`},{name:`elements_per_thread`,type:`u32`}]).declareVariables(...r)}
  ${t.mainStart([l,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${Hr(i,a,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${l}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${o?`u32(past_sequence_length + workgroup_id.y + 1)`:`total_sequence_length`};
    var thread_max_vector = ${m}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${m}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(c){case 1:return`thread_max_vector`;case 2:return`max(thread_max_vector.x, thread_max_vector.y)`;case 4:return`max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))`;default:throw Error(`Unsupported components: ${c}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${l}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${m}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${m}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(c){case 1:return`sum_vector`;case 2:return`sum_vector.x + sum_vector.y`;case 4:return`sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w`;default:throw Error(`Unsupported components: ${c}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${l}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${n.type.value}(${u}(1.0) / ${u}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${m}(x[offset + i]);
        x[offset + i] = ${n.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${o?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${n.type.value}(${u}(0));
        }`:``};
  }`},getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:i,z:t*n},programUniforms:f})}},Wr=(e,t,n,r,i,a,o,s,c)=>{let l=o+a.kvSequenceLength,u=[a.batchSize,a.numHeads,a.sequenceLength,l],d=e>1&&r,f=a.kvNumHeads?a.kvNumHeads:a.numHeads,p=d?[a.batchSize,f,l,a.headSize]:void 0,m=a.nReps?a.nReps:1,h=a.scale===0?1/Math.sqrt(a.headSize):a.scale,g=G(a.headSize),_=a.headSize/g,v={x:Math.ceil(l/12),y:Math.ceil(a.sequenceLength/12),z:a.batchSize*a.numHeads},y=[{type:12,data:a.sequenceLength},{type:12,data:_},{type:12,data:l},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:1,data:h},{type:12,data:o},{type:12,data:a.kvSequenceLength},{type:12,data:m}],b=d&&r&&z.size(r.dims)>0,x=[`type`,`type`];b&&x.push(`type`),i&&x.push(`type`),s&&x.push(`type`),c&&x.push(`type`);let S=[{dims:u,dataType:t.dataType,gpuDataType:0}];return d&&S.push({dims:p,dataType:t.dataType,gpuDataType:0}),{name:`AttentionProbs`,shaderCache:{hint:`${g};${i!==void 0};${r!==void 0};${e}`,inputDependencies:x},getRunData:()=>({outputs:S,dispatchGroup:v,programUniforms:y}),getShaderSource:e=>{let a=q(`q`,t.dataType,t.dims,g),o=[a,q(`key`,n.dataType,n.dims,g)];if(b){let e=q(`past_key`,r.dataType,r.dims,g);o.push(e)}i&&o.push(q(`attention_bias`,i.dataType,i.dims));let l=s?q(`seq_lens`,s.dataType,s.dims):void 0;l&&o.push(l);let f=c?q(`total_sequence_length_input`,c.dataType,c.dims):void 0;f&&o.push(f);let h=J(`output`,t.dataType,u),_=[h];d&&_.push(J(`present_key`,t.dataType,p,g));let v=Tn(1,g);return`
  const TILE_SIZE = 12u;

  var<workgroup> tileQ: array<${a.type.storage}, 144>;
  var<workgroup> tileK: array<${a.type.storage}, 144>;
  ${e.registerUniforms([{name:`M`,type:`u32`},{name:`K`,type:`u32`},{name:`N`,type:`u32`},{name:`num_heads`,type:`u32`},{name:`head_size`,type:`u32`},{name:`alpha`,type:`f32`},{name:`past_sequence_length`,type:`u32`},{name:`kv_sequence_length`,type:`u32`},{name:`n_reps`,type:`u32`}]).declareVariables(...o,..._)}
  ${e.mainStart([12,12,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${m===1?`headIdx`:`headIdx / uniforms.n_reps`};
    let kv_num_heads = ${m===1?`uniforms.num_heads`:`uniforms.num_heads / uniforms.n_reps`};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${Hr(l,f,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${b&&d?`let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;`:``};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${d?`let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;`:``}
    var value = ${v}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${b&&d?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${d?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:``}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${v}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(g){case 1:return`value`;case 2:return`value.x + value.y`;case 4:return`value.x + value.y + value.z + value.w`;default:throw Error(`Unsupported components: ${g}`)}})()};
        output[outputIdx] = ${h.type.value} (sum * uniforms.alpha) + ${i?`attention_bias[outputIdx]`:`0.0`};
    }
  }`}}},Gr=(e,t,n,r,i,a,o=void 0,s=void 0)=>{let c=a+i.kvSequenceLength,l=i.nReps?i.nReps:1,u=i.vHiddenSize*l,d=e>1&&r,f=i.kvNumHeads?i.kvNumHeads:i.numHeads,p=d?[i.batchSize,f,c,i.headSize]:void 0,m=[i.batchSize,i.sequenceLength,u],h={x:Math.ceil(i.vHeadSize/12),y:Math.ceil(i.sequenceLength/12),z:i.batchSize*i.numHeads},g=[{type:12,data:i.sequenceLength},{type:12,data:c},{type:12,data:i.vHeadSize},{type:12,data:i.numHeads},{type:12,data:i.headSize},{type:12,data:u},{type:12,data:a},{type:12,data:i.kvSequenceLength},{type:12,data:l}],_=d&&r&&z.size(r.dims)>0,v=[`type`,`type`];_&&v.push(`type`),o&&v.push(`type`),s&&v.push(`type`);let y=[{dims:m,dataType:t.dataType,gpuDataType:0}];return d&&y.push({dims:p,dataType:t.dataType,gpuDataType:0}),{name:`AttentionScore`,shaderCache:{hint:`${r!==void 0};${e}`,inputDependencies:v},getRunData:()=>({outputs:y,dispatchGroup:h,programUniforms:g}),getShaderSource:e=>{let i=q(`probs`,t.dataType,t.dims),a=[i,q(`v`,n.dataType,n.dims)];_&&a.push(q(`past_value`,r.dataType,r.dims));let c=o?q(`seq_lens`,o.dataType,o.dims):void 0;o&&a.push(c);let u=s?q(`total_sequence_length_input`,s.dataType,s.dims):void 0;s&&a.push(u);let f=[J(`output`,t.dataType,m)];return d&&f.push(J(`present_value`,t.dataType,p)),`
  const TILE_SIZE = 12u;
  var<workgroup> tileQ: array<${i.type.value}, 144>;
  var<workgroup> tileV: array<${i.type.value}, 144>;
  ${e.registerUniforms([{name:`M`,type:`u32`},{name:`K`,type:`u32`},{name:`N`,type:`u32`},{name:`num_heads`,type:`u32`},{name:`head_size`,type:`u32`},{name:`v_hidden_size`,type:`u32`},{name:`past_sequence_length`,type:`u32`},{name:`kv_sequence_length`,type:`u32`},{name:`n_reps`,type:`u32`}]).declareVariables(...a,...f)}
  ${e.mainStart([12,12,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${l===1?`headIdx`:`headIdx / uniforms.n_reps`};
   let kv_num_heads = ${l===1?`uniforms.num_heads`:`uniforms.num_heads / uniforms.n_reps`};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${Hr(c,u,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${_&&d?`let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;`:``};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${d?`let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;`:``}
   var value = ${i.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${_&&d?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${d?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:``}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`}}},Kr=(e,t,n,r,i,a,o,s,c,l,u=void 0,d=void 0)=>{let f=Math.min(e.outputCount,1+ +!!o+ +!!s),p=f>1?o:void 0,m=f>1?s:void 0,h=f>1?l.pastSequenceLength:0,g=h+l.kvSequenceLength,_=c&&z.size(c.dims)>0?c:void 0,v=[t,n];p&&z.size(p.dims)>0&&v.push(p),_&&v.push(_),u&&v.push(u),d&&v.push(d);let y=e.compute(Wr(f,t,n,p,_,l,h,u,d),{inputs:v,outputs:f>1?[-1,1]:[-1]})[0];e.compute(Ur(y,l.batchSize,l.numHeads,h,l.sequenceLength,g,u,d),{inputs:u&&d?[y,u,d]:[y],outputs:[]});let b=[y,r];m&&z.size(m.dims)>0&&b.push(m),u&&b.push(u),d&&b.push(d),e.compute(Gr(f,y,r,m,l,h,u,d),{inputs:b,outputs:f>1?[0,2]:[0]})},qr=(e,t)=>{let n=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],r=t.sequenceLength,i=t.inputHiddenSize,a=t.headSize,o={x:Math.ceil(t.headSize/12),y:Math.ceil(t.sequenceLength/12),z:t.batchSize*t.numHeads},s=[e.inputs[0],e.inputs[1],e.inputs[2]],c=[{type:12,data:r},{type:12,data:i},{type:12,data:a},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}];return e.compute({name:`AttentionPrepare`,shaderCache:{inputDependencies:[`type`,`type`,`type`]},getRunData:()=>({outputs:[{dims:n,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:n,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:n,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:o,programUniforms:c}),getShaderSource:e=>{let t=J(`output_q`,s[0].dataType,n),r=J(`output_k`,s[0].dataType,n),i=J(`output_v`,s[0].dataType,n),a=q(`input`,s[0].dataType,s[0].dims),o=q(`weight`,s[1].dataType,s[1].dims),c=q(`bias`,s[2].dataType,s[2].dims),l=a.type.storage;return`
  const TILE_SIZE = 12u;
  var<workgroup> tileInput: array<${l}, 144>;
  var<workgroup> tileWeightQ: array<${l}, 144>;
  var<workgroup> tileWeightK: array<${l}, 144>;
  var<workgroup> tileWeightV: array<${l}, 144>;
  ${e.registerUniforms([{name:`M`,type:`u32`},{name:`K`,type:`u32`},{name:`N`,type:`u32`},{name:`num_heads`,type:`u32`},{name:`head_size`,type:`u32`},{name:`hidden_size`,type:`u32`},{name:`ldb`,type:`u32`}]).declareVariables(a,o,c,t,r,i)}
  ${e.mainStart([12,12,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${l}(0);
    var valueK = ${l}(0);
    var valueV = ${l}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`}},{inputs:s,outputs:[-1,-1,-1]})},Jr=(e,t)=>{let n=Vr(e.inputs,t),[r,i,a]=qr(e,n);return Kr(e,r,i,a,e.inputs[4],void 0,void 0,void 0,e.inputs[5],n)}}),Xr,Zr,Qr,$r,ei=c(()=>{Me(),L(),B(),H(),Y(),Xr=(e,t)=>{if(!e||e.length!==5)throw Error(`BatchNormalization requires 5 inputs`);let n=(e,t,n)=>{let r=t.length;if(r!==e.length)throw Error(`${n}: num dimensions != ${r}`);t.forEach((t,r)=>{if(t!==e[r])throw Error(`${n}: dim[${r}] do not match`)})};if(e[0].dims.length>1){let r=t.format===`NHWC`?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);n(e[1].dims,r,`Invalid input scale`),n(e[2].dims,r,`Invalid input B`),n(e[3].dims,r,`Invalid input mean`),n(e[4].dims,r,`Invalid input var`)}else n(e[1].dims,[1],`Invalid input scale`),n(e[2].dims,[1],`Invalid input B`),n(e[3].dims,[1],`Invalid input mean`),n(e[4].dims,[1],`Invalid input var`)},Zr=(e,t)=>{let{epsilon:n,spatial:r,format:i}=t,a=e[0].dims,o=r?G(a[a.length-1]):1,s=i===`NHWC`&&a.length>1?o:1,c=z.size(a)/o,l=r,u=l?a.length:a,d=q(`x`,e[0].dataType,e[0].dims,o),f=q(`scale`,e[1].dataType,e[1].dims,s),p=q(`bias`,e[2].dataType,e[2].dims,s),m=q(`inputMean`,e[3].dataType,e[3].dims,s),h=q(`inputVar`,e[4].dataType,e[4].dims,s),g=J(`y`,e[0].dataType,u,o),_=()=>{let e=``;if(r)e=`let cOffset = ${a.length===1?`0u`:i===`NHWC`?`outputIndices[${a.length-1}] / ${o}`:`outputIndices[1]`};`;else if(i===`NCHW`)e=`
            ${g.indicesSet(`outputIndices`,`0`,`0`)}
            let cOffset = ${g.indicesToOffset(`outputIndices`)};`;else{e=`var cIndices = ${f.type.indices}(0);
                       cIndices[0] = outputIndices[${a.length-1}];`;for(let t=1;t<f.rank;t++)e+=`cIndices[${t}] = outputIndices[${t}];`;e+=`let cOffset = ${f.indicesToOffset(`cIndices`)};`}return e};return{name:`BatchNormalization`,shaderCache:{hint:`${t.epsilon}_${t.format}_${r}_${o}`,inputDependencies:l?[`rank`,`type`,`type`,`type`,`type`]:void 0},getShaderSource:e=>`
  const epsilon = ${n};
  ${e.registerUniform(`outputSize`,`u32`).declareVariables(d,f,p,m,h,g)}
  ${e.mainStart()}
  ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
    var outputIndices = ${g.offsetToIndices(`global_idx * ${o}`)};
    ${_()}
    let scale = ${f.getByOffset(`cOffset`)};
    let bias = ${p.getByOffset(`cOffset`)};
    let inputMean = ${m.getByOffset(`cOffset`)};
    let inputVar = ${h.getByOffset(`cOffset`)};
    let x = ${d.getByOffset(`global_idx`)};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${g.setByOffset(`global_idx`,`value`)}
  }`,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:l?[{type:12,data:c},...W(a)]:[{type:12,data:c}]})}},Qr=e=>V(e),$r=(e,t)=>{let{inputs:n,outputCount:r}=e,i=Qr({...t,outputCount:r});if(w.webgpu.validateInputContent&&Xr(n,i),t.trainingMode)throw Error(`BatchNormalization trainingMode is not supported yet.`);e.compute(Zr(n,i))}}),ti,ni,ri,ii=c(()=>{B(),Y(),ti=e=>{if(e[0].dims.length!==3)throw Error(`input should have 3 dimensions`);if(![320,640,1280].includes(e[0].dims[2]))throw Error(`number of channels should be 320, 640 or 1280`);if(e[1].dims.length!==1)throw Error(`bias is expected to have 1 dimensions`);if(e[0].dims[2]!==e[1].dims[0])throw Error(`last dimension of input and bias are not the same`)},ni=e=>{let t=e[0].dims,n=e[0].dims[2],r=z.size(t)/4,i=e[0].dataType,a=q(`input`,i,t,4),o=q(`bias`,i,[n],4),s=q(`residual`,i,t,4),c=J(`output`,i,t,4);return{name:`BiasAdd`,getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(r/64)}}),getShaderSource:e=>`
  const channels = ${n}u / 4;
  ${e.declareVariables(a,o,s,c)}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(r)}
    let value = ${a.getByOffset(`global_idx`)}
      + ${o.getByOffset(`global_idx % channels`)} + ${s.getByOffset(`global_idx`)};
    ${c.setByOffset(`global_idx`,`value`)}
  }`}},ri=e=>{ti(e.inputs),e.compute(ni(e.inputs))}}),ai,$,oi,si,ci,li,ui,di,fi,pi,mi,hi,gi,_i,vi,yi,bi,xi,Si,Ci,wi,Ti,Ei,Di,Oi,ki,Ai,ji,Mi,Ni,Pi,Fi,Ii,Li,Ri,zi,Bi,Vi,Hi,Ui,Wi,Gi,Ki,qi,Ji,Yi=c(()=>{L(),B(),H(),Y(),ai=(e,t,n,r,i,a,o)=>{let s=Math.ceil(t/4),c=``;c=typeof i==`string`?`${i}(a)`:i(`a`);let l=q(`inputData`,n,[s],4),u=J(`outputData`,r,[s],4),d=[{name:`vec_size`,type:`u32`}];return o&&d.push(...o),`
      ${e.registerUniforms(d).declareVariables(l,u)}

  ${a==null?``:a}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.vec_size`)}

    let a = ${l.getByOffset(`global_idx`)};
    ${u.setByOffset(`global_idx`,c)}
  }`},$=(e,t,n,r,i,a=e.dataType,o,s)=>{let c=[{type:12,data:Math.ceil(z.size(e.dims)/4)}];return o&&c.push(...o),{name:t,shaderCache:{hint:i,inputDependencies:[`type`]},getShaderSource:t=>ai(t,z.size(e.dims),e.dataType,a,n,r,s),getRunData:t=>({outputs:[{dims:e.dims,dataType:a}],dispatchGroup:{x:Math.ceil(z.size(t[0].dims)/64/4)},programUniforms:c})}},oi=e=>{e.compute($(e.inputs[0],`Abs`,`abs`))},si=e=>{e.compute($(e.inputs[0],`Acos`,`acos`))},ci=e=>{e.compute($(e.inputs[0],`Acosh`,`acosh`))},li=e=>{e.compute($(e.inputs[0],`Asin`,`asin`))},ui=e=>{e.compute($(e.inputs[0],`Asinh`,`asinh`))},di=e=>{e.compute($(e.inputs[0],`Atan`,`atan`))},fi=e=>{e.compute($(e.inputs[0],`Atanh`,`atanh`))},pi=e=>V(e),mi=(e,t)=>{let n;switch(t.to){case 10:n=`vec4<f16>`;break;case 1:n=`vec4<f32>`;break;case 12:n=`vec4<u32>`;break;case 6:n=`vec4<i32>`;break;case 9:n=`vec4<bool>`;break;default:throw RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute($(e.inputs[0],`Cast`,n,void 0,t.cacheKey,t.to))},hi=e=>{let t,n,r=e.length>=2&&e[1].data!==0,i=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=r?e[1].getFloat32Array()[0]:-34028234663852886e22,n=i?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=r?e[1].getUint16Array()[0]:64511,n=i?e[2].getUint16Array()[0]:31743;break;default:throw Error(`Unsupport data type`)}return V({min:t,max:n})},gi=(e,t)=>{let n=t||hi(e.inputs),r=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`Clip`,e=>`clamp(${e}, vec4<${r}>(uniforms.min), vec4<${r}>(uniforms.max))`,void 0,n.cacheKey,void 0,[{type:e.inputs[0].dataType,data:n.min},{type:e.inputs[0].dataType,data:n.max}],[{name:`min`,type:r},{name:`max`,type:r}]),{inputs:[0]})},_i=e=>{e.compute($(e.inputs[0],`Ceil`,`ceil`))},vi=e=>{e.compute($(e.inputs[0],`Cos`,`cos`))},yi=e=>{e.compute($(e.inputs[0],`Cosh`,`cosh`))},bi=e=>V(e),xi=(e,t)=>{let n=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`Elu`,e=>`elu_vf32(${e})`,`
  const elu_alpha_ = ${n}(${t.alpha});

  fn elu_f32(a: ${n}) -> ${n} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${n}>) -> vec4<${n}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},Si=(e=`f32`)=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,Ci=e=>{let t=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`Erf`,e=>`erf_vf32(${e})`,Si(t)))},wi=e=>{e.compute($(e.inputs[0],`Exp`,`exp`))},Ti=e=>{e.compute($(e.inputs[0],`Floor`,`floor`))},Ei=e=>{let t=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`Gelu`,e=>`0.5 * ${e} * (1.0 + erf_vf32(${e} * 0.7071067811865475))`,Si(t)))},Di=(e,t)=>{let n=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`LeakyRelu`,e=>`select(leaky_relu_alpha_ * ${e}, ${e}, ${e} >= vec4<${n}>(0.0))`,`const leaky_relu_alpha_ = ${n}(${t.alpha});`,t.cacheKey))},Oi=e=>{e.compute($(e.inputs[0],`Not`,e=>`!${e}`))},ki=e=>{e.compute($(e.inputs[0],`Neg`,e=>`-${e}`))},Ai=e=>{e.compute($(e.inputs[0],`Reciprocal`,e=>`1.0/${e}`))},ji=e=>{let t=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`Relu`,e=>`select(vec4<${t}>(0.0), ${e}, ${e} > vec4<${t}>(0.0))`))},Mi=e=>{e.compute($(e.inputs[0],`Sigmoid`,e=>`(1.0 / (1.0 + exp(-${e})))`))},Ni=e=>V(e),Pi=(e,t)=>{let n=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`HardSigmoid`,e=>`max(vec4<${n}>(0.0), min(vec4<${n}>(1.0), ${t.alpha} * ${e} + vec4<${n}>(${t.beta})))`,void 0,t.cacheKey))},Fi=e=>{e.compute($(e.inputs[0],`Sin`,`sin`))},Ii=e=>{e.compute($(e.inputs[0],`Sinh`,`sinh`))},Li=e=>{e.compute($(e.inputs[0],`Sqrt`,`sqrt`))},Ri=e=>{e.compute($(e.inputs[0],`Tan`,`tan`))},zi=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Bi=e=>{e.compute($(e.inputs[0],`Tanh`,zi))},Vi=(e=`f32`)=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${zi(`v`)};
}
`,Hi=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,Ui=e=>{let t=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`FastGelu`,Hi,Vi(t),void 0,e.inputs[0].dataType))},Wi=(e,t)=>{let n=Tn(e.inputs[0].dataType);return e.compute($(e.inputs[0],`ThresholdedRelu`,e=>`select(vec4<${n}>(0.0), ${e}, ${e} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${n}>(${t.alpha});`,t.cacheKey)),0},Gi=e=>{e.compute($(e.inputs[0],`Log`,`log`))},Ki=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,qi=e=>`quick_gelu_impl(${e})`,Ji=(e,t)=>{let n=Tn(e.inputs[0].dataType);e.compute($(e.inputs[0],`QuickGelu`,qi,Ki(n,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),Xi,Zi,Qi,$i=c(()=>{B(),Y(),Yi(),Xi=e=>{if(e[0].dims.length!==3)throw Error(`input should have 3 dimensions`);if(![2560,5120,10240].includes(e[0].dims[2]))throw Error(`hidden state should be 2560, 5120 or 10240`);if(e[1].dims.length!==1)throw Error(`bias is expected to have 1 dimensions`);if(e[0].dims[2]!==e[1].dims[0])throw Error(`last dimension of input and bias are not the same`)},Zi=e=>{let t=e[0].dims.slice();t[2]/=2;let n=q(`input`,e[0].dataType,e[0].dims,4),r=q(`bias`,e[0].dataType,[e[0].dims[2]],4),i=J(`output`,e[0].dataType,t,4),a=z.size(t)/4,o=U(e[0].dataType);return{name:`BiasSplitGelu`,getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(a/64)}}),getShaderSource:t=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${t.declareVariables(n,r,i)}

  ${Si(o)}

  ${t.mainStart()}
    ${t.guardAgainstOutOfBoundsWorkgroupSizes(a)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${i.setByOffset(`global_idx`,`valueLeft * geluRight`)}
  }`}},Qi=e=>{Xi(e.inputs),e.compute(Zi(e.inputs))}}),ea,ta,na,ra,ia,aa,oa,sa,ca,la,ua,da,fa,pa=c(()=>{L(),B(),Y(),ea=(e,t,n,r,i,a,o,s,c,l,u,d)=>{let f,p;typeof s==`string`?f=p=(e,t)=>`${s}((${e}),(${t}))`:typeof s==`function`?f=p=s:(f=s.scalar,p=s.vector);let m=J(`outputData`,u,r.length,4),h=q(`aData`,c,t.length,4),g=q(`bData`,l,n.length,4),_;if(i)if(a){let e=z.size(t)===1,r=z.size(n)===1,i=t.length>0&&t[t.length-1]%4==0,a=n.length>0&&n[n.length-1]%4==0;_=e||r?m.setByOffset(`global_idx`,p(e?`${h.type.value}(${h.getByOffset(`0`)}.x)`:h.getByOffset(`global_idx`),r?`${g.type.value}(${g.getByOffset(`0`)}.x)`:g.getByOffset(`global_idx`))):`
            let outputIndices = ${m.offsetToIndices(`global_idx * 4u`)};
            let offsetA = ${h.broadcastedIndicesToOffset(`outputIndices`,m)};
            let offsetB = ${g.broadcastedIndicesToOffset(`outputIndices`,m)};
            ${m.setByOffset(`global_idx`,p(o||i?h.getByOffset(`offsetA / 4u`):`${h.type.value}(${h.getByOffset(`offsetA / 4u`)}[offsetA % 4u])`,o||a?g.getByOffset(`offsetB / 4u`):`${g.type.value}(${g.getByOffset(`offsetB / 4u`)}[offsetB % 4u])`))}
          `}else _=m.setByOffset(`global_idx`,p(h.getByOffset(`global_idx`),g.getByOffset(`global_idx`)));else{if(!a)throw Error(`no necessary to use scalar implementation for element-wise binary op implementation.`);let e=(e,t,n=``)=>{let r=`aData[indexA${t}][componentA${t}]`,i=`bData[indexB${t}][componentB${t}]`;return`
            let outputIndices${t} = ${m.offsetToIndices(`global_idx * 4u + ${t}u`)};
            let offsetA${t} = ${h.broadcastedIndicesToOffset(`outputIndices${t}`,m)};
            let offsetB${t} = ${g.broadcastedIndicesToOffset(`outputIndices${t}`,m)};
            let indexA${t} = offsetA${t} / 4u;
            let indexB${t} = offsetB${t} / 4u;
            let componentA${t} = offsetA${t} % 4u;
            let componentB${t} = offsetB${t} % 4u;
            ${e}[${t}] = ${n}(${f(r,i)});
          `};_=u===9?`
            var data = vec4<u32>(0);
            ${e(`data`,0,`u32`)}
            ${e(`data`,1,`u32`)}
            ${e(`data`,2,`u32`)}
            ${e(`data`,3,`u32`)}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:`
            ${e(`outputData[global_idx]`,0)}
            ${e(`outputData[global_idx]`,1)}
            ${e(`outputData[global_idx]`,2)}
            ${e(`outputData[global_idx]`,3)}
          `}return`
        ${e.registerUniform(`vec_size`,`u32`).declareVariables(h,g,m)}

        ${d==null?``:d}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.vec_size`)}
        ${_}
      }`},ta=(e,t,n,r,i,a,o=n.dataType)=>{let s=n.dims.map(Number),c=r.dims.map(Number),l=!z.areEqual(s,c),u=s,d=z.size(s),f=!1,p=!1,m=[l];if(l){let e=Vt.calcShape(s,c,!1);if(!e)throw Error(`Can't perform binary op on the given tensors`);u=e.slice(),d=z.size(u);let t=z.size(s)===1,n=z.size(c)===1,r=s.length>0&&s[s.length-1]%4==0,i=c.length>0&&c[c.length-1]%4==0;m.push(t),m.push(n),m.push(r),m.push(i);let a=1;for(let e=1;e<u.length;e++){let t=s[s.length-e];if(t===c[c.length-e])a*=t;else break}a%4==0?(p=!0,f=!0):(t||n||r||i)&&(f=!0)}else f=!0;return m.push(f),{name:e,shaderCache:{hint:t+m.map(e=>e.toString()).join(`_`),inputDependencies:[`rank`,`rank`]},getShaderSource:e=>ea(e,s,c,u,f,l,p,i,n.dataType,r.dataType,o,a),getRunData:()=>({outputs:[{dims:u,dataType:o}],dispatchGroup:{x:Math.ceil(d/64/4)},programUniforms:[{type:12,data:Math.ceil(z.size(u)/4)},...W(s,c,u)]})}},na=(e,t,n,r,i,a)=>{e.compute(ta(t,i==null?``:i,e.inputs[0],e.inputs[1],n,r,a))},ra=e=>{na(e,`Add`,(e,t)=>`${e}+${t}`)},ia=e=>{na(e,`Div`,(e,t)=>`${e}/${t}`)},aa=e=>{na(e,`Equal`,{scalar:(e,t)=>`u32(${e}==${t})`,vector:(e,t)=>`vec4<u32>(${e}==${t})`},void 0,void 0,9)},oa=e=>{na(e,`Mul`,(e,t)=>`${e}*${t}`)},sa=e=>{let t=q(`input`,e.inputs[0].dataType,e.inputs[0].dims).type.value;na(e,`Pow`,{scalar:(e,t)=>`pow_custom(${e},${t})`,vector:(e,t)=>`pow_vector_custom(${e},${t})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t===`i32`?`round`:``}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},ca=e=>{na(e,`Sub`,(e,t)=>`${e}-${t}`)},la=e=>{na(e,`Greater`,{scalar:(e,t)=>`u32(${e}>${t})`,vector:(e,t)=>`vec4<u32>(${e}>${t})`},void 0,void 0,9)},ua=e=>{na(e,`Less`,{scalar:(e,t)=>`u32(${e}<${t})`,vector:(e,t)=>`vec4<u32>(${e}<${t})`},void 0,void 0,9)},da=e=>{na(e,`GreaterOrEqual`,{scalar:(e,t)=>`u32(${e}>=${t})`,vector:(e,t)=>`vec4<u32>(${e}>=${t})`},void 0,void 0,9)},fa=e=>{na(e,`LessOrEqual`,{scalar:(e,t)=>`u32(${e}<=${t})`,vector:(e,t)=>`vec4<u32>(${e}<=${t})`},void 0,void 0,9)}}),ma,ha,ga,_a,va,ya,ba=c(()=>{L(),B(),H(),Y(),ma=(e,t)=>{if(!e||e.length<1)throw Error(`too few inputs`);let n=e[0],r=n.dataType,i=n.dims.length;e.forEach((e,a)=>{if(a!==0){if(e.dataType!==r)throw Error(`input tensors should be one type`);if(e.dims.length!==i)throw Error(`input tensors should have the same shape`);e.dims.forEach((e,r)=>{if(r!==t&&e!==n.dims[r])throw Error(`non concat dimensions must match`)})}})},ha=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,ga=(e,t)=>{let n=e.length,r=[];for(let i=0;i<n;++i){let a=t.setByOffset(`global_idx`,e[i].getByIndices(`indices`));n===1?r.push(a):i===0?r.push(`if (inputIndex == ${i}u) { ${a} }`):i===n-1?r.push(`else { ${a} }`):r.push(`else if (inputIndex == ${i}) { ${a} }`)}return r.join(`
`)},_a=(e,t,n,r)=>{let i=z.size(n),a=Array(e.length),o=Array(e.length),s=0,c=[],l=[],u=[{type:12,data:i}];for(let n=0;n<e.length;++n)s+=e[n].dims[t],a[n]=s,l.push(e[n].dims.length),o[n]=q(`input${n}`,r,l[n]),c.push(`rank`),u.push({type:12,data:a[n]});for(let t=0;t<e.length;++t)u.push(...W(e[t].dims));u.push(...W(n));let d=J(`output`,r,n.length),f=d.indicesGet(`indices`,t),p=Array.from(Array(a.length).keys()).map(e=>`uniforms.sizeInConcatAxis${e}`).join(`,`);return{name:`Concat`,shaderCache:{hint:`${t}`,inputDependencies:c},getRunData:()=>({outputs:[{dims:n,dataType:r}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:u}),getShaderSource:t=>`

  ${(()=>{t.registerUniform(`outputSize`,`u32`);for(let n=0;n<e.length;n++)t.registerUniform(`sizeInConcatAxis${n}`,`u32`);return t.declareVariables(...o,d)})()}

  ${ha(a.length,p)}

  ${t.mainStart()}
    ${t.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}

    var indices = ${d.offsetToIndices(`global_idx`)};

    let inputIndex = calculateInputIndex(${f});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${a.length}u>(${p});
      ${f} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${ga(o,d)}
  }`}},va=(e,t)=>{let n=e.inputs,r=n[0].dims,i=z.normalizeAxis(t.axis,r.length);ma(n,i);let a=r.slice();a[i]=n.reduce((e,t)=>e+(t.dims.length>i?t.dims[i]:0),0);let o=n.filter(e=>z.size(e.dims)>0);e.compute(_a(o,i,a,n[0].dataType),{inputs:o})},ya=e=>V({axis:e.axis})}),xa,Sa,Ca,wa,Ta=c(()=>{L(),B(),xa=(e,t,n=`f32`)=>{switch(e.activation){case`Relu`:return`value = max(value, ${t}(0.0));`;case`Sigmoid`:return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case`Clip`:return`value = clamp(value, ${t}(${n}(uniforms.clip_min)), ${t}(${n}(uniforms.clip_max)));`;case`HardSigmoid`:return`value = max(${t}(0.0), min(${t}(1.0), ${n}(uniforms.alpha) * value + ${n}(uniforms.beta)));`;case`LeakyRelu`:return`value = select(${n}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case`Tanh`:return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case``:return``;default:throw Error(`Unsupported activation ${e.activation}`)}},Sa=(e,t)=>{e.activation===`Clip`?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation===`HardSigmoid`?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation===`LeakyRelu`&&t.push({type:1,data:e.alpha})},Ca=(e,t)=>{e.activation===`Clip`?t.push({name:`clip_max`,type:`f32`},{name:`clip_min`,type:`f32`}):e.activation===`HardSigmoid`?t.push({name:`alpha`,type:`f32`},{name:`beta`,type:`f32`}):e.activation===`LeakyRelu`&&t.push({name:`alpha`,type:`f32`})},wa=e=>{let t=(e==null?void 0:e.activation)||``;if(t===`HardSigmoid`){let[n,r]=(e==null?void 0:e.activation_params)||[.2,.5];return{activation:t,alpha:n,beta:r}}else if(t===`Clip`){let[n,r]=(e==null?void 0:e.activation_params)||[Wt,Gt];return{activation:t,clipMax:r,clipMin:n}}else if(t===`LeakyRelu`){let[n]=(e==null?void 0:e.activation_params)||[.01];return{activation:t,alpha:n}}return{activation:t}}}),Ea,Da,Oa=c(()=>{Ea=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw Error(`${e}-component is not supported.`)}},Da=e=>`
      ${e?`value = value + getBiasByOutputCoords(coords);`:``}
      `}),ka,Aa=c(()=>{ka=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),ja,Ma,Na=c(()=>{L(),B(),Y(),Ta(),ja=(e,t,n,r,i)=>{let a=r-n;return`
      ${Array.from({length:n}).map((n,o)=>`
      if (${K(t.shape,o,t.rank)} != 1) {
        ${t.indicesSet(e,o,K(i,o+a,r))}
      } else {
        ${t.indicesSet(e,o,0)}
      }`).join(``)}
`},Ma=(e,t,n,r,i=!1,a)=>{let o=e[0].dims,s=e[1].dims,c=o[o.length-2],l=s[s.length-1],u=o[o.length-1],d=G(l),f=G(u),p=G(c),m=z.size(n)/d/p,h=e.length>2,g=r?r.slice(0,-2):n.slice(0,-2),_=[z.size(g),c,l],v=[{type:12,data:m},{type:12,data:c},{type:12,data:l},{type:12,data:u}];return Sa(t,v),v.push(...W(g,o,s)),h&&v.push(...W(e[2].dims)),v.push(...W(_)),{name:`MatMulNaive`,shaderCache:{hint:`${t.activation};${d};${f};${p};${i}`,inputDependencies:h?[`rank`,`rank`,`rank`]:[`rank`,`rank`]},getRunData:()=>({outputs:[{dims:a?a(n):n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(m/64)},programUniforms:v}),getShaderSource:r=>{let a=jn(`batch_dims`,e[0].dataType,g.length),c=q(`a`,e[0].dataType,o.length,f),l=q(`b`,e[1].dataType,s.length,d),u=J(`output`,e[0].dataType,_.length,d),m=U(u.type.tensor),v=xa(t,u.type.value,m),y=[c,l],b=``;if(h){let t=i?d:1;y.push(q(`bias`,e[2].dataType,e[2].dims.length,t)),b=`${i?`value += bias[col / ${t}];`:`value += ${u.type.value}(bias[row + i]);`}`}let x=[{name:`output_size`,type:`u32`},{name:`M`,type:`u32`},{name:`N`,type:`u32`},{name:`K`,type:`u32`}];Ca(t,x);let S=()=>{let e=`var a_data: ${c.type.value};`;for(let t=0;t<f;t++)e+=`
              let b_data${t} = b[(b_offset + (k + ${t}) * uniforms.N + col) / ${d}];`;for(let t=0;t<p;t++){e+=`a_data = a[(a_offset + (row + ${t}) * uniforms.K + k) / ${f}];`;for(let n=0;n<f;n++)e+=`
            values[${t}] = fma(${l.type.value}(a_data${f===1?``:`[${n}]`}), b_data${n}, values[${t}]);
`}return e};return`
  ${r.registerUniforms(x).registerInternalVariables(a).declareVariables(...y,u)}
  ${r.mainStart()}
    ${r.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
    let col = (global_idx % (uniforms.N / ${d})) * ${d};
    var index1 = global_idx / (uniforms.N / ${d});
    let stride1 = uniforms.M / ${p};
    let row = (index1 % stride1) * ${p};
    let batch = index1 / stride1;

    ${n.length===2?``:`let batch_indices = ${a.offsetToIndices(`batch`)};`}

    var a_indices: ${c.type.indices};
    ${ja(`a_indices`,c,c.rank-2,a.rank,`batch_indices`)}
    ${c.indicesSet(`a_indices`,c.rank-2,0)}
    ${c.indicesSet(`a_indices`,c.rank-1,0)}
    let a_offset = ${c.indicesToOffset(`a_indices`)};

    var b_indices: ${l.type.indices};
    ${ja(`b_indices`,l,l.rank-2,a.rank,`batch_indices`)}
    ${l.indicesSet(`b_indices`,l.rank-2,0)}
    ${l.indicesSet(`b_indices`,l.rank-1,0)}
    let b_offset = ${l.indicesToOffset(`b_indices`)};
    var values: array<${u.type.value}, ${p}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${f}) {
      ${S()}
    }
    for (var i = 0u; i < ${p}u; i++) {
      var value = values[i];
      ${b}
      ${v}
      let cur_indices = ${u.type.indices}(batch, row + i, col);
      let offset = ${u.indicesToOffset(`cur_indices`)};
      ${u.setByOffset(`offset / ${d}`,`value`)};
    }
  }
  `}}}}),Pa,Fa,Ia,La,Ra,za,Ba,Va,Ha=c(()=>{L(),B(),Y(),Ta(),Na(),Oa(),Pa=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?`, batchIndices`:``});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?`, batchIndices`:``});
        `,Fa=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?``:`let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];`}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?``:`acc[i] = BCached3 * ACached3[i] + acc[i];`}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?``:`acc[i] = BCached3 * ACached.w + acc[i];`}
        }`,Ia=(e,t,n=`f32`,r,i=!1,a=32,o=!1,s=32)=>{let c=t[1]*e[1],l=t[0]*e[0],u=i?c:a,d=i?a:c,f=u/t[0],p=a/t[1];if(!((i&&f===4&&e[1]===4||!i&&(f===3||f===4))&&u%t[0]===0&&a%t[1]===0&&e[0]===4))throw Error(`If transposeA ${i} is true, innerElementSize ${f} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${f} must be 3 or 4.
  tileAWidth ${u} must be divisible by workgroupSize[0]${t[0]}. tileInner ${a} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${f}<${n}>, ${u/f}>, ${d}>;
var<workgroup> mm_Bsub: array<array<vec4<${n}>, ${l/e[0]}>, ${a}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${f};
const tileInner = ${a};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${o?`0`:`i32(globalId.z)`};
  ${r?`let batchIndices = ${r.offsetToIndices(`u32(batch)`)};`:``}
  let globalRowStart = i32(workgroupId.y) * ${c};

  let num_tiles = ${o?`${Math.ceil(s/a)}`:`(uniforms.dim_inner - 1) / tileInner + 1`};
  var kStart = ${o?`i32(globalId.z) * ${s}`:`0`};

  var acc: array<vec4<${n}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${p};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${Pa(i,r)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${p}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${r?`, batchIndices`:``});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${f===3?``:`let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];`}

          ${Fa(i,f)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},La=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?`, batchIndices`:``});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?`, batchIndices`:``});
            `,Ra=e=>e?`let ACached = mm_Asub[k][tileRow + innerRow];`:`let ACached = mm_Asub[tileRow + innerRow][k];`,za=(e,t,n=`f32`,r,i=!1,a=32,o=!1,s=32,c=!1)=>{let l=e[1]*t[1],u=e[0]*t[0],d=i?l:a,f=i?a:l;if(!(f%t[1]===0&&d%t[0]===0&&a%t[1]===0))throw Error(`tileAHight ${f} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${d} must be divisible by workgroupSize[0]${t[0]}, tileInner ${a} must be divisible by workgroupSize[1]${t[1]}`);let p=f/t[1],m=d/t[0],h=a/t[1],g=c?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${l};
    let globalColStart = i32(workgroupId.x) * ${u};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${f}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${d}; inputCol = inputCol + ${t[0]}) {
          ${La(i,r)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${a}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${u}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${r?`, batchIndices`:``});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${n}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${i?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${l};

let tileRowA = i32(localId.y) * ${p};
let tileColA = i32(localId.x) * ${m};
let tileRowB = i32(localId.y) * ${h};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${p}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${m}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${La(i,r)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${h}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${r?`, batchIndices`:``});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${n}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${Ra(i)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${n}, ${d}>, ${f}>;
  var<workgroup> mm_Bsub : array<array<${n}, ${u}>, ${a}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${a};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${o?`0`:`i32(globalId.z)`};
    ${r?`let batchIndices = ${r.offsetToIndices(`u32(batch)`)};`:``}
    let num_tiles = ${o?`${Math.ceil(s/a)}`:`(uniforms.dim_inner - 1) / tileInner + 1`};
    var kStart = ${o?`i32(globalId.z) * ${s}`:`0`};

    var acc : array<array<${n}, colPerThread>, rowPerThread>;
    ${g}
  }
`},Ba=(e,t,n,r,i=!1)=>{let[a,o,s,c]=r,l=U(r[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${a.type.indices}) -> ${Ea(e,l)} {
      var value = ${Ea(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${o.type.indices};
        ${ja(`aIndices`,o,o.rank-2,a.rank,`batchIndices`)}
        ${o.indicesSet(`aIndices`,o.rank-2,`u32(row)`)}
        ${o.indicesSet(`aIndices`,o.rank-1,`u32(colIn)`)}
        value = ${o.getByIndices(`aIndices`)};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${a.type.indices}) -> ${Ea(e,l)} {
      var value = ${Ea(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${s.type.indices};
        ${ja(`bIndices`,s,s.rank-2,a.rank,`batchIndices`)}
        ${s.indicesSet(`bIndices`,s.rank-2,`u32(row)`)}
        ${s.indicesSet(`bIndices`,s.rank-1,`u32(colIn)`)}
        value = ${s.getByIndices(`bIndices`)};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Ea(e,l)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${i?`bias[colIn]`:`${Ea(e,l)}(bias[row])`};`:``}
        ${n}
        ${c.setByIndices(`vec3<u32>(coords)`,`value`)}
      }
    }
    `},Va=(e,t,n,r,i=!1,a)=>{let o=e[0].dims,s=e[1].dims,c=o.slice(0,-2),l=s.slice(0,-2),u=r?r.slice(0,-2):n.slice(0,-2),d=z.size(u),f=o[o.length-2],p=o[o.length-1],m=s[s.length-1],h=p%4==0&&m%4==0,g=f<=8?[4,1,1]:[4,4,1],_=[8,8,1],v=[Math.ceil(m/_[0]/g[0]),Math.ceil(f/_[1]/g[1]),Math.ceil(d/_[2]/g[2])],y=h?4:1,b=[...c,f,p/y],x=b.length,S=[...l,p,m/y],C=S.length,w=[d,f,m/y],T=[{type:6,data:f},{type:6,data:m},{type:6,data:p}];Sa(t,T),T.push(...W(u,b,S));let ee=[`rank`,`rank`],E=e.length>2;return E&&(T.push(...W(e[2].dims)),ee.push(`rank`)),T.push(...W(w)),{name:`MatMul`,shaderCache:{hint:`${g};${t.activation};${h};${i}`,inputDependencies:ee},getRunData:()=>({outputs:[{dims:a?a(n):n,dataType:e[0].dataType}],dispatchGroup:{x:v[0],y:v[1],z:v[2]},programUniforms:T}),getShaderSource:n=>{let r=u.length,a=jn(`batchDims`,e[0].dataType,r,1),o=U(e[0].dataType),s=q(`a`,e[0].dataType,x,y),c=q(`b`,e[1].dataType,C,y),l=J(`result`,e[0].dataType,w.length,y),d=[s,c];if(E){let t=i?y:1;d.push(q(`bias`,e[2].dataType,e[2].dims.length,t))}let f=[{name:`dim_a_outer`,type:`i32`},{name:`dim_b_outer`,type:`i32`},{name:`dim_inner`,type:`i32`}];Ca(t,f);let p=U(l.type.tensor),m=xa(t,l.type.value,p),v=Ba(y,E,m,[a,s,c,l],i);return`
  ${n.registerUniforms(f).registerInternalVariables(a).declareVariables(...d,l)}
  ${v}
  ${h?Ia(g,_,o,a):za(g,_,o,a)}
                   `}}}}),Ua,Wa,Ga=c(()=>{L(),zt(),Y(),Ta(),Oa(),Aa(),Ha(),Ua=(e,t,n,r,i=!1,a,o=4,s=4,c=4,l=`f32`)=>{let u=e=>{switch(e){case 1:return`resData = x[xIndex];`;case 3:return`resData = vec3<${l}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return`resData = x[xIndex / 4];`;default:throw Error(`innerElementSize ${e} is not supported.`)}},d=e=>{switch(e){case 1:return`return w[row * i32(uniforms.w_shape[3]) + colIn];`;case 4:return`return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];`;default:throw Error(`innerElementSize ${e} is not supported.`)}},f=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,p=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,m=e?`i32(uniforms.x_shape[1])`:`i32(uniforms.x_shape[2])`,h=e?`i32(uniforms.x_shape[2])`:`i32(uniforms.x_shape[3])`,g=e?`row`:`col`,_=e?`col`:`row`,v=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?`i32(uniforms.result_shape[2])`:`i32(uniforms.result_shape[3])`};
    let outRow = ${g} / outWidth;
    let outCol = ${g} % outWidth;

    let WRow = ${_} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${_} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${_} % inChannels;
    var resData = ${Ea(o,l)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${m} && xCol >= 0 && xCol < ${h}) {
      ${f}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${u(o)}
    }
    return resData;`,y=e?t&&r?`
    let col = colIn * ${o};
    ${v}`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${v}
    }
    return ${Ea(o,l)}(0.0);`:r&&n?`
    let col = colIn * ${o};
    ${v}`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${v}
    }
    return ${Ea(o,l)}(0.0);`,b=e?r&&n?d(s):`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${d(s)}
    }
    return ${Ea(s,l)}(0.0);`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${d(s)}
    }
    return ${Ea(s,l)}(0.0);`,x=Ea(c,l),S=Ea(e?o:s,l),C=Ea(e?s:o,l),w=xa(a,x,l);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${S} {
      ${e?y:b}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${C} {
      ${e?b:y}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${x}) {
      let col = colIn * ${c};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?`i32(uniforms.result_shape[2])`:`i32(uniforms.result_shape[3])`};
      ${p}
      ${Da(i)}
      ${w}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},Wa=(e,t,n,r,i,a,o,s,c)=>{let l=t.format===`NHWC`,u=l?e[0].dims[3]:e[0].dims[1],d=n[0],f=l?n[2]:n[3],p=l?n[1]:n[2],m=l?n[3]:n[1],h=l&&(u%4==0||u%3==0)&&m%4==0,g=l?m:f*p,_=l?f*p:m,v=[8,8,1],y=r<=8?[4,1,1]:[4,4,1],b=[Math.ceil(g/v[0]/y[0]),Math.ceil(_/v[1]/y[1]),Math.ceil(d/v[2]/y[2])];R(`verbose`,()=>`[conv2d_mm_webgpu] dispatch = ${b}`);let x=h?l&&u%4!=0?3:4:1,S=v[1]*y[1],C=v[0]*y[0],w=Math.max(v[0]*x,v[1]),T=r%S===0,ee=i%C===0,E=a%w===0,te=h?[x,4,4]:[1,1,1],D=[{type:6,data:r},{type:6,data:i},{type:6,data:a},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];Sa(t,D),D.push(...W(e[0].dims,e[1].dims));let O=[`rank`,`rank`];return o&&(D.push(...W(e[2].dims)),O.push(`rank`)),D.push(...W(n)),{name:`Conv2DMatMul`,shaderCache:{hint:`${t.cacheKey};${x};${h};${T};${ee};${E};${S};${C};${w}`,inputDependencies:O},getRunData:()=>({outputs:[{dims:c?c(n):n,dataType:e[0].dataType}],dispatchGroup:{x:b[0],y:b[1],z:b[2]},programUniforms:D}),getShaderSource:r=>{let i=[{name:`dim_a_outer`,type:`i32`},{name:`dim_b_outer`,type:`i32`},{name:`dim_inner`,type:`i32`},{name:`pad`,type:`i32`,length:2},{name:`stride`,type:`i32`,length:2},{name:`dilation`,type:`i32`,length:2}];Ca(t,i);let a=h?4:1,c=U(e[0].dataType),u=`
      fn setOutputAtIndex(flatIndex : i32, value : ${h?`vec4<${c}>`:c}) {
        result[flatIndex] = ${h?`vec4<${c}>`:c}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${h?`vec4<${c}>`:c}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${h?`/ 4`:``}, value);
      }`,d=[q(`x`,e[0].dataType,e[0].dims.length,x===3?1:x),q(`w`,e[1].dataType,e[1].dims.length,a)],f=J(`result`,e[0].dataType,n.length,a);if(o){let t=q(`bias`,e[2].dataType,e[2].dims.length,a);d.push(t),u+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${h?`vec4<${c}>`:c} {
          return bias[coords.${l?`w`:`y`}${h?`/ 4`:``}];
        }`}return`
        ${ka(`uniforms.result_strides`)}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${r.registerUniforms(i).declareVariables(...d,f)}
        ${u}
        ${Ua(l,T,ee,E,o,t,te[0],te[1],te[2],c)}
        ${h?Ia(y,v,c,void 0,!l,w):za(y,v,c,void 0,!l,w,!1,void 0,s)}`}}}}),Ka,qa,Ja,Ya,Xa,Za,Qa,$a,eo=c(()=>{L(),zt(),B(),Y(),Ta(),Oa(),Ka=e=>{let t=1;for(let n=0;n<e.length;n++)t*=e[n];return t},qa=e=>typeof e==`number`?[e,e,e]:e,Ja=(e,t)=>t<=1?e:e+(e-1)*(t-1),Ya=(e,t,n,r=1)=>{let i=Ja(t,r);return Math.floor((e[0]*(n-1)-n+i)/2)},Xa=(e,t,n,r,i)=>{i==null&&(i=Ya(e,t[0],r[0]));let a=[0,0,0,n];for(let n=0;n<3;n++)e[n]+2*i>=t[n]&&(a[n]=Math.trunc((e[n]-t[n]+2*i)/r[n]+1));return a},Za=(e,t,n,r,i,a,o,s,c,l)=>{let u,d,f,p;if(e===`VALID`&&(e=0),typeof e==`number`){u={top:e,bottom:e,left:e,right:e,front:e,back:e};let m=Xa([t,n,r,1],[s,c,l],1,[i,a,o],e);d=m[0],f=m[1],p=m[2]}else if(Array.isArray(e)){if(!e.every((e,t,n)=>e===n[0]))throw Error(`Unsupported padding parameter: ${e}`);u={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let m=Xa([t,n,r,1],[s,c,l],1,[i,a,o],e[0]);d=m[0],f=m[1],p=m[2]}else if(e===`SAME_UPPER`){d=Math.ceil(t/i),f=Math.ceil(n/a),p=Math.ceil(r/o);let e=(d-1)*i+s-t,m=(f-1)*a+c-n,h=(p-1)*o+l-r,g=Math.floor(e/2),_=e-g,v=Math.floor(m/2),y=m-v,b=Math.floor(h/2);u={top:v,bottom:y,left:b,right:h-b,front:g,back:_}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:u,outDepth:d,outHeight:f,outWidth:p}},Qa=(e,t,n,r,i,a=!1,o=`channelsLast`)=>{let s,c,l,u,d;if(o===`channelsLast`)[s,c,l,u,d]=e;else if(o===`channelsFirst`)[s,d,c,l,u]=e;else throw Error(`Unknown dataFormat ${o}`);let[f,,p,m,h]=t,[g,_,v]=qa(n),[y,b,x]=qa(r),S=Ja(p,y),C=Ja(m,b),w=Ja(h,x),{padInfo:T,outDepth:ee,outHeight:E,outWidth:te}=Za(i,c,l,u,g,_,v,S,C,w),D=a?f*d:f,O=[0,0,0,0,0];return o===`channelsFirst`?O=[s,D,ee,E,te]:o===`channelsLast`&&(O=[s,ee,E,te,D]),{batchSize:s,dataFormat:o,inDepth:c,inHeight:l,inWidth:u,inChannels:d,outDepth:ee,outHeight:E,outWidth:te,outChannels:D,padInfo:T,strideDepth:g,strideHeight:_,strideWidth:v,filterDepth:p,filterHeight:m,filterWidth:h,effectiveFilterDepth:S,effectiveFilterHeight:C,effectiveFilterWidth:w,dilationDepth:y,dilationHeight:b,dilationWidth:x,inShape:e,outShape:O,filterShape:t}},$a=(e,t,n,r,i,a)=>{let o=a===`channelsLast`;o?e[0].dims[3]:e[0].dims[1];let s=[64,1,1],c={x:n.map((e,t)=>t)},l=[Math.ceil(Ka(c.x.map(e=>n[e]))/s[0]),1,1];R(`verbose`,()=>`[conv3d_naive_webgpu] dispatch = ${l}`);let u=[{type:12,data:z.size(n)},{type:12,data:r},{type:12,data:i},{type:12,data:t.strides},{type:12,data:t.dilations}];Sa(t,u),u.push(...W(e[0].dims,e[1].dims));let d=[`rank`,`rank`],f=e.length===3;return f&&(u.push(...W(e[2].dims)),d.push(`rank`)),u.push(...W(n)),{name:`Conv3DNaive`,shaderCache:{hint:`${t.cacheKey};${o};1;${f}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:l[0],y:l[1],z:l[2]},programUniforms:u}),getShaderSource:a=>{let s=[{name:`output_size`,type:`u32`},{name:`filter_dims`,type:`u32`,length:r.length},{name:`pads`,type:`u32`,length:i.length},{name:`strides`,type:`u32`,length:t.strides.length},{name:`dilations`,type:`u32`,length:t.dilations.length}];Ca(t,s);let c=U(e[0].dataType),l=q(`x`,e[0].dataType,e[0].dims.length,1),u=q(`W`,e[1].dataType,e[1].dims.length,1),d=[l,u],p=J(`result`,e[0].dataType,n.length,1),m=``;if(f){let t=q(`bias`,e[2].dataType,e[2].dims.length,1);d.push(t),m+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${c} {
          return bias[${o?K(`coords`,4,5):K(`coords`,1,5)}];
        }`}let h=Ea(1,c),g=xa(t,h,c);return`
            ${m}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${l.getByIndices(`aIndices`)};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${u.getByIndices(`aIndices`)};
            }
          ${a.registerUniforms(s).declareVariables(...d,p)}
          ${a.mainStart()}
          ${a.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
              let coords = ${p.offsetToIndices(`global_idx`)};
              let batch = ${K(`coords`,0,l.rank)};
              let d2 = ${o?K(`coords`,l.rank-1,l.rank):K(`coords`,1,l.rank)};
              let xFRCCorner = vec3<u32>(${o?K(`coords`,1,l.rank):K(`coords`,2,l.rank)},
              ${o?K(`coords`,2,l.rank):K(`coords`,3,l.rank)},
              ${o?K(`coords`,3,l.rank):K(`coords`,4,l.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${o?K(`uniforms.x_shape`,1,l.rank):K(`uniforms.x_shape`,2,l.rank)};
              let xShapeZ = ${o?K(`uniforms.x_shape`,2,l.rank):K(`uniforms.x_shape`,3,l.rank)};
              let xShapeW = ${o?K(`uniforms.x_shape`,3,l.rank):K(`uniforms.x_shape`,4,l.rank)};
              let xShapeU = ${o?K(`uniforms.x_shape`,4,l.rank):K(`uniforms.x_shape`,1,l.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${o?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${o?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${o?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${o?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${f?`value = value + getBiasByOutputCoords(coords)`:``};
              ${g}
              result[global_idx] = f32(value);
          }`}}}}),to,no,ro=c(()=>{L(),B(),Y(),Ta(),to=(e,t,n,r)=>{let i=e.length>2,a=i?`value += b[output_channel];`:``,o=e[0].dims,s=e[1].dims,c=t.format===`NHWC`,l=c?n[3]:n[1],u=l/t.group,d=c&&u>=4?G(l):1,f=z.size(n)/d,p=[{type:12,data:f},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:u}];Sa(t,p),p.push(...W(o,[s[0],s[1],s[2],s[3]/d]));let m=i?[`rank`,`rank`,`rank`]:[`rank`,`rank`];return p.push(...W([n[0],n[1],n[2],n[3]/d])),{name:`GroupedConv`,shaderCache:{hint:`${t.cacheKey}_${d}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:r?r(n):n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:p}),getShaderSource:r=>{let l=J(`output`,e[0].dataType,n.length,d),u=U(l.type.tensor),f=xa(t,l.type.value,u),p=q(`x`,e[0].dataType,o.length),m=q(`w`,e[1].dataType,s.length,d),h=[p,m];i&&h.push(q(`b`,e[2].dataType,e[2].dims,d));let g=[{name:`output_size`,type:`u32`},{name:`dilations`,type:`u32`,length:t.dilations.length},{name:`strides`,type:`u32`,length:2},{name:`pads`,type:`u32`,length:2},{name:`output_channels_per_group`,type:`u32`}];Ca(t,g);let _=c?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${p.get(`batch`,`xHeight`,`xWidth`,`input_channel`)};
            let wVal = ${m.get(`wHeight`,`wWidth`,`wInChannel`,`output_channel`)};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${p.get(`batch`,`input_channel`,`xHeight`,`xWidth`)};
            let wVal = ${m.get(`output_channel`,`wInChannel`,`wHeight`,`wWidth`)};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${r.registerUniforms(g).declareVariables(...h,l)}

  ${r.mainStart()}
    ${r.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}

    let outputIndices = ${l.offsetToIndices(`global_idx`)};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${c?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${c?1:2}], outputIndices[${c?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${d} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${c?2:1}];

    var value: ${l.type.value} = ${l.type.value}(0);
    ${_}
    ${a}
    ${f}
    ${l.setByOffset(`global_idx`,`value`)}
  }`}}},no=(e,t,n,r)=>{let i=e.length>2,a=G(n[3]),o=G(n[2]),s=z.size(n)/a/o,c=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/a],l=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/a],u=[n[0],n[1],n[2],n[3]/a],d=[{type:12,data:s},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];Sa(t,d),d.push(...W(c,l,u));let f=(o-1)*t.strides[1]+l[1];return{name:`GroupedConv-Vectorize`,shaderCache:{hint:`${t.cacheKey};${a};${o};${f};${l[0]};${l[1]}`,inputDependencies:i?[`rank`,`rank`,`type`]:[`rank`,`rank`]},getRunData:()=>({outputs:[{dims:r?r(n):n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:d}),getShaderSource:n=>{let r=J(`output`,e[0].dataType,u.length,a),s=U(r.type.tensor),d=xa(t,r.type.value,s),p=q(`x`,e[0].dataType,c.length,a),m=q(`w`,e[1].dataType,l.length,a),h=[p,m];i&&h.push(q(`b`,e[2].dataType,e[2].dims,a));let g=i?`value += b[output_channel];`:``,_=[{name:`output_size`,type:`u32`},{name:`strides`,type:`i32`,length:2},{name:`pads`,type:`i32`,length:2}];return Ca(t,_),`
  ${n.registerUniforms(_).declareVariables(...h,r)}
  ${n.mainStart()}
    ${n.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${o}u;
    let col = (index1 % width1) * ${o}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${p.type.value}, ${f}>;
    var values: array<${r.type.value}, ${o}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${l[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${f}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${p.get(`batch`,`u32(x_height)`,`u32(x_width)`,`input_channel`)};
          } else {
            x_vals[i] = ${p.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${l[1]}; w_width++) {
          let w_val = ${m.get(`w_height`,`w_width`,`0`,`output_channel`)};
          for (var i = 0u; i < ${o}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${o}u; i++) {
      var value = values[i];
      ${g}
      ${d}
      ${r.set(`batch`,`row`,`col + i`,`output_channel`,`value`)};
    }
  }`}}}}),io,ao,oo,so,co,lo,uo,fo,po,mo=c(()=>{B(),Ga(),eo(),Ha(),ro(),Ta(),Na(),Un(),io=(e,t,n,r,i,a)=>{let o=e[0],s=e.slice(a?1:2,a?3:4),c=s.length,l=t[0],u=t.slice(2).map((e,t)=>e+(e-1)*(n[t]-1)),d=s.map((e,t)=>e+r[t]+r[t+c]).map((e,t)=>Math.floor((e-u[t]+i[t])/i[t]));return d.splice(0,0,o),d.splice(a?3:1,0,l),d},ao=[2,3,1,0],oo=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw Error(`Conv requires 2 or 3 inputs`);if(e[0].dims.length>5)throw Error(`greater than 5D is not supported`);if(e[0].dims.length!==e[1].dims.length)throw Error(`filter does not have same dimension as input`);if(e[0].dims[t.format===`NHWC`?e[0].dims.length-1:1]!==e[1].dims[1]*t.group)throw Error(`FILTER_IN_CHANNEL should be equal to DATA_CHANNEL`);if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw Error(`invalid bias`);let n=e[0].dims.length-2;if(t.dilations.length!==n)throw Error(`dilations should be ${n}D`);if(t.strides.length!==n)throw Error(`strides should be ${n}D`);if(t.pads.length!==n*2)throw Error(`pads should be ${n*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw Error(`invalid kernel shape`)},so=(e,t)=>{let n=e.kernelShape.slice();n.length<t[1].dims.length-2&&n.push(...Array(t[1].dims.length-2-n.length).fill(0));for(let e=2;e<t[1].dims.length;++e)n[e-2]===0&&(n[e-2]=t[1].dims[e]);let r=e.pads.slice();Ht.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,n,r,e.format===`NHWC`,e.autoPad);let i=Object.assign({},e);return Object.assign(i,{kernelShape:n,pads:r}),i},co=e=>{let t=wa(e),n=e.format;return{autoPad:[`NOTSET`,`VALID`,`SAME_UPPER`,`SAME_LOWER`][e.auto_pad],format:n,dilations:e.dilations,group:e.group,kernelShape:e.kernel_shape,pads:e.pads,strides:e.strides,wIsConst:e.w_is_const(),...t,cacheKey:`${e.format};${t.activation};`}},lo=(e,t,n,r)=>{var i;let a=n.format===`NHWC`,o=io(t[0].dims,t[1].dims,n.dilations,n.pads,n.strides,a);if(n.group!==1){let i=[t[0]];if(a){var s;let r=(s=e.kernelCustomData.wT)==null?e.compute(Bn(t[1],ao),{inputs:[1],outputs:[n.wIsConst?-2:-1]})[0]:s;n.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=r),i.push(r)}else i.push(t[1]);t.length===3&&i.push(t[2]),!e.adapterInfo.isArchitecture(`ampere`)&&a&&t[1].dims[0]===n.group&&t[1].dims[1]===1&&n.dilations[0]===1&&n.dilations[1]===1?e.compute(no(i,n,o,r),{inputs:i}):e.compute(to(i,n,o,r),{inputs:i});return}let c=t.length===3,l=t[0].dims[a?1:2],u=t[0].dims[a?2:3],d=t[0].dims[a?3:1],f=t[1].dims[2],p=t[1].dims[3],m=o[a?1:2],h=o[a?2:3],g=o[a?3:1],_=a&&f===l&&p===u&&n.pads[0]===0&&n.pads[1]===0;if(_||f===1&&p===1&&n.dilations[0]===1&&n.dilations[1]===1&&n.strides[0]===1&&n.strides[1]===1&&n.pads[0]===0&&n.pads[1]===0){let i=o[0],s,f,p,y=[];if(a){var v;let r=(v=e.kernelCustomData.wT)==null?e.compute(Bn(t[1],ao),{inputs:[1],outputs:[n.wIsConst?-2:-1]})[0]:v;if(n.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=r),_){let e=l*u*d;s=t[0].reshape([1,i,e]),f=r.reshape([1,e,g]),p=[1,i,g]}else s=t[0].reshape([i,l*u,d]),f=r.reshape([1,d,g]),p=[i,m*h,g];y.push(s),y.push(f)}else s=t[0].reshape([i,d,l*u]),f=t[1].reshape([1,g,d]),p=[i,g,m*h],y.push(f),y.push(s);c&&y.push(t[2]);let b=p[2],x=y[0].dims[y[0].dims.length-1];b<8&&x<8?e.compute(Ma(y,n,o,p,a,r),{inputs:y}):e.compute(Va(y,n,o,p,a,r),{inputs:y});return}let y=(i=e.kernelCustomData.wT)==null?e.compute(Bn(t[1],ao),{inputs:[1],outputs:[n.wIsConst?-2:-1]})[0]:i;n.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=y);let b=[t[0],y];c&&b.push(t[2]);let x=a?m*h:g,S=a?g:m*h,C=f*p*d;e.compute(Wa(b,n,o,x,S,C,c,!0,r),{inputs:b})},uo=(e,t)=>{let n=t.format===`NHWC`,r=[e.inputs[0].reshape(n?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&r.push(e.inputs[2]);let i=[0,t.pads[0],0,t.pads[1]],a=[1].concat(t.strides),o=[1].concat(t.dilations),s=[1].concat(t.kernelShape),c=so({...t,pads:i,strides:a,dilations:o,kernelShape:s},r);lo(e,r,c,e=>n?[e[0],e[2],e[3]]:[e[0],e[1],e[3]])},fo=(e,t,n)=>{let r=n.format===`NHWC`?`channelsLast`:`channelsFirst`,i=so(n,t),a=n.autoPad===`NOTSET`?n.pads:n.autoPad,o=Qa(t[0].dims,t[1].dims,n.strides,n.dilations,a,!1,r);e.compute($a(t,i,o.outShape,[o.filterDepth,o.filterHeight,o.filterWidth],[o.padInfo.front,o.padInfo.top,o.padInfo.left],r))},po=(e,t)=>{if(oo(e.inputs,t),e.inputs[0].dims.length===3)uo(e,t);else if(e.inputs[0].dims.length===5)fo(e,e.inputs,t);else{let n=so(t,e.inputs);lo(e,e.inputs,n)}}}),ho,go=c(()=>{L(),zt(),B(),Y(),ho=(e,t,n)=>{let r=e.length>2,i=t.outputShape,a=t.format===`NHWC`,o=t.group,s=e[1].dims,c=s[2]/o,l=s[3],u=a?G(c):1,d=a&&l===1&&c>=4,f=d?Math.floor(c/4)*4:Math.floor(c/u)*u,p=c-f,m=a?G(l):1,h=a?l===1?u:m:1,g=z.size(i)/m,_=[Math.ceil(g/64),1,1];R(`verbose`,()=>`[conv2d_backprop_webgpu] dispatch = ${_}`);let v=[`rank`,`rank`],y=[t.strides[0],t.strides[1]],b=[t.kernelShape[a?1:2],t.kernelShape[a?2:3]],x=[t.dilations[0],t.dilations[1]],S=[b[0]+(t.dilations[0]<=1?0:(t.kernelShape[a?1:2]-1)*(t.dilations[0]-1)),b[1]+(t.dilations[1]<=1?0:(t.kernelShape[a?2:3]-1)*(t.dilations[1]-1))],C=[S[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),S[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],w=[{type:12,data:g},{type:12,data:y},{type:12,data:b},{type:12,data:x},{type:12,data:S},{type:6,data:C},{type:12,data:f},{type:12,data:c},{type:12,data:l},...W(e[0].dims,e[1].dims)];return r&&(w.push(...W(e[2].dims)),v.push(`rank`)),w.push(...W(i)),{name:`ConvTranspose2D`,shaderCache:{hint:`${t.cacheKey};${u}${h}${m}${d}${p}`,inputDependencies:v},getRunData:()=>({dispatchGroup:{x:_[0],y:_[1],z:_[2]},outputs:[{dims:n?n(i):i,dataType:e[0].dataType}],programUniforms:w}),getShaderSource:t=>{let n=[{name:`output_size`,type:`u32`},{name:`strides`,type:`u32`,length:y.length},{name:`filter_dims`,type:`u32`,length:b.length},{name:`dilations`,type:`u32`,length:b.length},{name:`effective_filter_dims`,type:`u32`,length:S.length},{name:`pads`,type:`i32`,length:C.length},{name:`input_channels_per_group_int`,type:`u32`},{name:`input_channels_per_group`,type:`u32`},{name:`output_channels_per_group`,type:`u32`}],o=U(e[0].dataType),s=a?1:2,c=a?2:3,l=a?3:1,f=q(`W`,e[1].dataType,e[1].dims.length,h),g=q(`Dy`,e[0].dataType,e[0].dims.length,u),_=[g,f];r&&_.push(q(`bias`,e[2].dataType,[i[l]].length,m));let v=J(`result`,e[0].dataType,i.length,m),x=`
            let outputIndices = ${v.offsetToIndices(`global_idx * ${m}`)};
            let batch = ${v.indicesGet(`outputIndices`,0)};
            let d1 = ${v.indicesGet(`outputIndices`,l)};
            let r = ${v.indicesGet(`outputIndices`,s)};
            let c = ${v.indicesGet(`outputIndices`,c)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${v.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${o}(dyRCorner) + ${o}(wR)) / ${o}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${o}(uniforms.Dy_shape[${s}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${o}(dyCCorner) + ${o}(wC)) / ${o}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${o}(uniforms.Dy_shape[${c}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${d?`
                var x_offset = ${g.indicesToOffset(`${g.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${u};
                var w_offset = ${f.indicesToOffset(`${f.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${h};
                  `:``}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${d?4:u}) {
                  ${(()=>{let e=``;if(d)u===4?e+=`
        let xValue = ${g.getByOffset(`x_offset`)};
        let wValue = ${f.getByOffset(`w_offset`)};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:u===2?e+=`
          dotProd = dotProd + dot(vec4<${o}>(${g.getByOffset(`x_offset`)}, ${g.getByOffset(`x_offset + 1u`)}), vec4<${o}>(${f.getByOffset(`w_offset`)}, ${f.getByOffset(`w_offset + 1u`)}));
          x_offset += 2u;
          w_offset += 2u;`:u===1&&(e+=`
          dotProd = dotProd + dot(vec4<${o}>(${g.getByOffset(`x_offset`)}, ${g.getByOffset(`x_offset + 1u`)}, ${g.getByOffset(`x_offset + 2u`)}, ${g.getByOffset(`x_offset + 3u`)}), vec4<${o}>(${f.getByOffset(`w_offset`)}, ${f.getByOffset(`w_offset + 1u`)}, ${f.getByOffset(`w_offset + 2u`)}, ${f.getByOffset(`w_offset + 3u`)}));
          x_offset += 4u;
          w_offset += 4u;`);else if(e+=`
                  let xValue = ${a?g.getByOffset(`${g.indicesToOffset(`${g.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${u}`):g.get(`batch`,`inputChannel`,`idyR`,`idyC`)};
        `,u===1)e+=`
          let w_offset = ${f.indicesToOffset(`${f.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${f.getByOffset(`w_offset / ${h}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let t=0;t<u;t++)e+=`
            let wValue${t} = ${f.getByOffset(`${f.indicesToOffset(`${f.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${t}, wOutChannel)`)} / ${h}`)};
            dotProd = dotProd + xValue[${t}] * wValue${t};`;return e})()}
                  inputChannel = inputChannel + ${d?4:u};
                }
                ${(()=>{if(p===0)return``;if(!d)throw Error(`packInputAs4 ${d} is not true.`);let e=``;if(u===1){e+=`dotProd = dotProd`;for(let t=0;t<p;t++)e+=`
            + ${g.getByOffset(`x_offset + ${t}`)} * ${f.getByOffset(`w_offset + ${t}`)}`;e+=`;`}else if(u===2){if(p!==2)throw Error(`Invalid inputChannelsRemainder ${p}.`);e+=`
          let xValue = ${g.getByOffset(`x_offset`)};
          let wValue = ${f.getByOffset(`w_offset`)};
          dotProd = dotProd + dot(xValue, wValue);`}return e})()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${r?` + bias[d1 / ${m}]`:``};
            ${v.setByOffset(`global_idx`,`value`)};
          `;return`
    ${t.registerUniforms(n).declareVariables(..._,v)}
      ${t.mainStart()}
      ${t.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)};
    ${x}}`}}}}),_o,vo,yo,bo,xo,So,Co,wo,To,Eo=c(()=>{go(),Ta(),Un(),_o=(e,t,n,r,i,a)=>(e-1)*t+n+(r-1)*i+1-a,vo=(e,t,n,r,i)=>{let a=Math.floor(e/2);t===`SAME_UPPER`?(n[r]=a,n[i]=e-a):t===`SAME_LOWER`&&(n[r]=e-a,n[i]=a)},yo=(e,t,n,r,i,a,o,s,c,l)=>{let u=e.length-2,d=l.length===0;c.length<u&&c.push(...Array(u-c.length).fill(0));let f=e[0],p=t[s?3:1]*i;for(let i=0,f=e.length-u-+!!s;i<u;++i,++f){let s=e[f],p=d?s*o[i]:l[i],m=_o(s,o[i],a[i],t[f],n[i],p);vo(m,r,a,i,i+u),d&&l.push(o[i]*(s-1)+c[i]+(t[f]-1)*n[i]+1-a[i]-a[i+u])}l.splice(0,0,f),l.splice(s?3:1,0,p)},bo=(e,t)=>{let n=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((e,t)=>e*t,1)===0){n.length=0;for(let e=2;e<t[1].dims.length;++e)n.push(t[1].dims[e])}let r=e.format===`NHWC`;n.splice(0,0,t[1].dims[0]),n.splice(r?3:1,0,t[1].dims[1]);let i=e.pads.slice(),a=e.outputShape.slice(),o=e.outputPadding.slice(),s=t[0].dims,c=e.dilations.slice();if(c.reduce((e,t)=>e+t,0)===0){let e=t[0].dims.length-2;c=Array(e).fill(1)}let l=e.strides.slice();if(l.reduce((e,t)=>e+t,0)===0){let e=t[0].dims.length-2;l=Array(e).fill(1)}yo(s,n,c,e.autoPad,e.group,i,l,r,o,a);let u=Object.assign({},e);return Object.assign(u,{kernelShape:n,pads:i,outputPadding:o,outputShape:a,dilations:c,strides:l}),u},xo=e=>{var t;let n=wa(e),r=e.format,i=[`NOTSET`,`VALID`,`SAME_UPPER`,`SAME_LOWER`][typeof e.autoPad>`u`?0:e.autoPad],a=e.dilations,o=(t=e.group)==null?1:t,s=e.kernelShape,c=e.pads,l=e.strides,u=e.wIsConst();return{autoPad:i,format:r,dilations:a,group:o,kernelShape:s,outputPadding:e.outputPadding,outputShape:e.outputShape,pads:c,strides:l,wIsConst:u,...n,cacheKey:`${e.format};${n.activation};`}},So=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw Error(`Conv requires 2 or 3 inputs`);if(e[0].dims.length!==4&&e[0].dims.length!==3)throw Error(`currently only support 2-dimensional conv`);if(e[0].dims.length!==e[1].dims.length)throw Error(`filter does not have same dimension as input`);if(e[0].dims[t.format===`NHWC`?e[0].dims.length-1:1]!==e[1].dims[0])throw Error(`FILTER_IN_CHANNEL should be equal to DATA_CHANNEL`);let n=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==n))throw Error(`invalid bias`);let r=e[0].dims.length-2;if(t.dilations.reduce((e,t)=>e+t,0)>0&&t.dilations.length!==r)throw Error(`dilations should be ${r}D`);if(t.strides.reduce((e,t)=>e+t,0)>0&&t.strides.length!==r)throw Error(`strides should be ${r}D`);if(t.pads.reduce((e,t)=>e+t,0)>0&&t.pads.length!==r*2)throw Error(`pads should be ${r*2}D`);if(t.outputPadding.length!==r&&t.outputPadding.length!==0)throw Error(`output_padding should be ${r}D`);if(t.kernelShape.reduce((e,t)=>e+t,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw Error(`invalid kernel shape`);if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw Error(`invalid output shape`)},Co=(e,t,n,r)=>{var i;let a=(i=e.kernelCustomData.wT)==null?e.compute(Bn(t[1],[2,3,0,1]),{inputs:[1],outputs:[n.wIsConst?-2:-1]})[0]:i;n.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=a);let o=[t[0],a];t.length===3&&o.push(t[2]),e.compute(ho(o,n,r),{inputs:o})},wo=(e,t)=>{let n=t.format===`NHWC`,r=[e.inputs[0].reshape(n?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&r.push(e.inputs[2]);let i=t.kernelShape;(i.length===0||i[0]===0)&&(i=[e.inputs[1].dims[2]]);let a=t.dilations;(a.length===0||a[0]===0)&&(a=[1]);let o=t.strides;(o.length===0||o[0]===0)&&(o=[1]);let s=t.pads;s.length===0&&(s=[0,0]),s=[0,s[0],0,s[1]],o=[1].concat(o),a=[1].concat(a),i=[1].concat(i);let c=t.outputPadding;c=[0].concat(c);let l=bo({...t,pads:s,strides:o,dilations:a,kernelShape:i,outputPadding:c},r);Co(e,r,l,e=>n?[e[0],e[2],e[3]]:[e[0],e[1],e[3]])},To=(e,t)=>{if(So(e.inputs,t),e.inputs[0].dims.length===3)wo(e,t);else{let n=bo(t,e.inputs);Co(e,e.inputs,n)}}}),Do,Oo,ko,Ao=c(()=>{L(),B(),H(),Y(),Do=(e,t,n,r)=>{let i=z.size(t),a=t.length,o=q(`input`,e,a),s=J(`output`,e,a),c=n.dataType===6?n.getInt32Array()[0]:Number(n.getBigInt64Array()[0]),l=z.normalizeAxis(c,a);return{name:`CumSum`,shaderCache:{hint:r.cacheKey,inputDependencies:[`rank`]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:[{type:12,data:i},{type:12,data:l},...W(t,t)]}),getShaderSource:e=>{let t=` i32(${o.indicesGet(`inputIndices`,`uniforms.axis`)}) `,n=K(`uniforms.input_shape`,`uniforms.axis`,a),i=r.reverse?t+(r.exclusive?` + 1`:``):`0`,c=r.reverse?n:t+(r.exclusive?``:` + 1`);return`
                ${e.registerUniform(`outputSize`,`u32`).registerUniform(`axis`,`u32`).declareVariables(o,s)}
                ${e.mainStart()}
                  ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
                  var inputIndices = ${s.offsetToIndices(`global_idx`)};
                  var sum = ${s.type.value}(0);
                  let first : i32 = ${i};
                  let last : i32 = ${c};
                  for (var i : i32 = first; i < last; i++) {
                    ${o.indicesSet(`inputIndices`,`uniforms.axis`,`u32(i)`)};
                    sum = sum + ${o.getByIndices(`inputIndices`)};
                  }
                  ${s.setByOffset(`global_idx`,`sum`)};
                }`}}},Oo=(e,t)=>{let n=e.inputs[0].dims,r=e.inputs[0].dataType,i=e.inputs[1];e.compute(Do(r,n,i,t),{inputs:[0]})},ko=e=>{let t=e.exclusive===1,n=e.reverse===1;return V({exclusive:t,reverse:n})}}),jo,Mo,No,Po,Fo,Io=c(()=>{L(),B(),H(),Y(),jo=e=>{if(!e||e.length!==1)throw Error(`DepthToSpace requires 1 input.`);if(e[0].dims.length!==4)throw Error(`DepthToSpace requires 4D input.`)},Mo=(e,t,n,r)=>{let i=[];i.push(`fn perm(i: ${r.type.indices}) -> ${n.type.indices} {
    var a: ${n.type.indices};`);for(let r=0;r<t;++r)i.push(n.indicesSet(`a`,e[r],`i[${r}]`));return i.push(`return a;}`),i.join(`
`)},No=(e,t)=>{let n,r,i,a,o,s,c=t.format===`NHWC`,l=t.blocksize,u=t.mode===`DCR`;c?([n,r,i,a]=e.dims,o=u?[n,r,i,l,l,a/l**2]:[n,r,i,a/l**2,l,l],s=u?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([n,r,i,a]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],o=u?[n,l,l,a/l**2,r,i]:[n,a/l**2,l,l,r,i],s=u?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let d=e.reshape(o),f=d.dims.length,p=e.dataType,m=q(`a`,p,f),h=J(`output`,p,f);return{name:`DepthToSpace`,shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:[`rank`]},getRunData:e=>{let t=c?[n,r*l,i*l,a/l**2]:[n,a/l**2,r*l,i*l],o=z.size(t),u=d.dims,f=z.sortBasedOnPerm(u,s);return{outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:[{type:12,data:o},...W(u,f)]}},getShaderSource:e=>`
  ${e.registerUniform(`output_size`,`u32`).declareVariables(m,h)}

  ${Mo(s,f,m,h)}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}

    let indices = ${h.offsetToIndices(`global_idx`)};
    let aIndices = perm(indices);

    ${h.setByOffset(`global_idx`,m.getByIndices(`aIndices`))}
  }`}},Po=(e,t)=>{jo(e.inputs),e.compute(No(e.inputs[0],t))},Fo=e=>V({blocksize:e.blocksize,mode:e.mode,format:e.format})}),Lo,Ro,zo,Bo,Vo,Ho,Uo,Wo,Go,Ko,qo,Jo=c(()=>{L(),B(),H(),Y(),Lo=`[a-zA-Z]|\\.\\.\\.`,Ro=`(`+Lo+`)+`,zo=`^`+Ro+`$`,Bo=`(`+Ro+`,)*`+Ro,Vo=`^`+Bo+`$`,Ho=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let n=this.symbolToIndices.get(e);n===void 0?n=[t]:n.push(t),this.symbolToIndices.set(e,n)}},Uo=class{constructor(e,t){var n;this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=[],this.outputDims=[];let[r,i]=t.includes(`->`)?t.split(`->`,2):[t,``];if(!r.match(RegExp(Vo)))throw Error(`Invalid LHS term`);if(r.split(`,`).forEach((t,n)=>{let r=e[n].dims.slice();if(!t.match(RegExp(zo)))throw Error(`Invalid LHS term`);let i=this.processTerm(t,!0,r,n);this.lhs.push(i)}),i===``)i+=[...this.symbolToInfo.entries()].filter(([e,t])=>t.count===1||e===`...`).map(([e])=>e).join(``);else if(!i.match(RegExp(Ro)))throw Error(`Invalid RHS`);(n=i.match(RegExp(Lo,`g`)))==null||n.forEach(e=>{if(e===`...`)this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let t=this.symbolToInfo.get(e);if(t===void 0)throw Error(`Invalid RHS symbol`);this.outputDims.push(t.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,n){let r=this.symbolToInfo.get(e);if(r!==void 0){if(r.dimValue!==t&&r.count!==1)throw Error(`Dimension mismatch`);r.count++,r.inputIndices.push(n)}else r={count:1,dimValue:t,inputIndices:[n]};this.symbolToInfo.set(e,r)}processTerm(e,t,n,r=-1){let i=n.length,a=!1,o=[],s=0;if(!e.match(RegExp(zo))&&!t&&e!==``)throw Error(`Invalid LHS term`);let c=e.match(RegExp(Lo,`g`)),l=new Ho(r);return c==null||c.forEach((e,u)=>{if(e===`...`){if(a)throw Error(`Only one ellipsis is allowed per input term`);a=!0;let e=i-c.length+1;if(e<0)throw Error(`Ellipsis out of bounds`);if(o=n.slice(s,s+e),this.hasEllipsis){if(this.ellipsisDims.length!==o.length||this.ellipsisDims.toString()!==o.toString())throw Error(`Ellipsis dimensions mismatch`)}else if(t)this.hasEllipsis=!0,this.ellipsisDims=o;else throw Error(`Ellipsis must be specified in the LHS`);for(let e=0;e<o.length;e++){let t=String.fromCharCode(48+e);l.addSymbol(t,u+e),this.addSymbol(t,n[s++],r)}}else l.addSymbol(e,u+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(e,n[s++],r)}),l}},Wo=e=>e+`_max`,Go=(e,t,n,r)=>{let i=e.map(e=>e.length).map((e,n)=>q(`input${n}`,t,e)),a=z.size(r),o=J(`output`,t,r.length),s=[...n.symbolToInfo.keys()].filter(e=>!n.rhs.symbolToIndices.has(e));return{name:`Einsum`,shaderCache:{hint:n.equation,inputDependencies:e.map(()=>`rank`)},getRunData:()=>{let i=s.filter(e=>n.symbolToInfo.has(e)).map(e=>{var t;return{type:12,data:((t=n.symbolToInfo.get(e))==null?void 0:t.dimValue)||0}});i.push({type:12,data:a});let o=e.map((e,t)=>[...W(e)]).reduce((e,t)=>e.concat(t),i);return o.push(...W(r)),{outputs:[{dims:r,dataType:t}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:o}},getShaderSource:e=>{let t=[],r=[],a=[],c=[],l=[],u=n.symbolToInfo.size===n.rhs.symbolToIndices.size;n.symbolToInfo.forEach((e,s)=>{if(n.rhs.symbolToIndices.has(s)){var u;let r=(u=n.rhs.symbolToIndices.get(s))==null?void 0:u[0];r!==void 0&&n.lhs.forEach((n,a)=>{if(e.inputIndices.includes(a)){let e=n.symbolToIndices.get(s);if(e===void 0)throw Error(`Invalid symbol error`);e.forEach(e=>{t.push(`${i[a].indicesSet(`input${a}Indices`,e,o.indicesGet(`outputIndices`,r))}`)})}})}else n.lhs.forEach((t,n)=>{if(e.inputIndices.includes(n)){let e=t.symbolToIndices.get(s);if(e===void 0)throw Error(`Invalid symbol error`);e.forEach(e=>{r.push(`${i[n].indicesSet(`input${n}Indices`,e,`${s}`)}`)}),l.push(`prod *= ${i[n].getByIndices(`input${n}Indices`)};`)}}),a.push(`for(var ${s}: u32 = 0; ${s} < uniforms.${Wo(s)}; ${s}++) {`),c.push(`}`)});let d=u?[...t,`let sum = ${i.map((e,t)=>e.getByIndices(`input${t}Indices`)).join(` * `)};`]:[...t,`var sum = 0.0;`,...a,...r,`var prod = 1.0;`,...l,`sum += prod;`,...c];return`
            ${e.registerUniforms(s.map(e=>({name:`${Wo(e)}`,type:`u32`}))).registerUniform(`outputSize`,`u32`).declareVariables(...i,o)}

            ${e.mainStart()}
            ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
            var outputIndices = ${o.offsetToIndices(`global_idx`)};
            ${i.map((e,t)=>`var input${t}Indices: ${i[t].type.indices};`).join(`
`)}
            ${d.join(`
`)};
            ${o.setByOffset(`global_idx`,`sum`)};
          }`}}},Ko=(e,t)=>{let n=new Uo(e.inputs,t.equation),r=n.outputDims,i=e.inputs.map((e,t)=>e.dims);e.compute(Go(i,e.inputs[0].dataType,n,r))},qo=e=>{let t=e.equation.replace(/\s+/g,``);return V({equation:t})}}),Yo,Xo,Zo,Qo,$o,es=c(()=>{L(),B(),Y(),Yo=e=>{if(!e||e.length!==2)throw Error(`Expand requires 2 input.`);let t=e[0].dims,n=Array.from(e[1].getBigInt64Array(),Number),r=n.length<t.length?0:n.length-t.length,i=t.length<n.length?0:t.length-n.length;for(;r<n.length&&i<t.length;++r,++i)if(n[r]!==t[i]&&n[r]!==1&&t[i]!==1)throw Error(`Expand requires shape to be broadcastable to input`)},Xo=(e,t)=>{let n=e.length-t.length,r=[];for(let t=0;t<n;++t)r.push(e[t]);for(let i=0;i<t.length;++i)r.push(t[i]===1?e[i+n]:t[i]);return r},Zo=(e,t)=>e.length>t.length?Xo(e,t):Xo(t,e),Qo=e=>{let t=e[0].dims,n=Array.from(e[1].getBigInt64Array(),Number),r=Zo(t,n),i=e[0].dataType,a=i===9||z.size(t)===1,o=i===9||t.length>0&&t[t.length-1]%4==0?4:1,s=a||r.length>0&&r[r.length-1]%4==0?4:1,c=Math.ceil(z.size(r)/s),l=e=>{let n=q(`input`,i,t.length,o),a=J(`output`,i,r.length,s),c;if(i===9){let e=(e,t,r=``)=>`
          let outputIndices${t} = ${a.offsetToIndices(`outputOffset + ${t}u`)};
          let offset${t} = ${n.broadcastedIndicesToOffset(`outputIndices${t}`,a)};
          let index${t} = offset${t} / 4u;
          let component${t} = offset${t} % 4u;
          ${e}[${t}] = ${r}(${n.getByOffset(`index${t}`)}[component${t}]);
        `;c=`
        let outputOffset = global_idx * ${s};
        var data = vec4<u32>(0);
        ${e(`data`,0,`u32`)}
        ${e(`data`,1,`u32`)}
        ${e(`data`,2,`u32`)}
        ${e(`data`,3,`u32`)}
        ${a.setByOffset(`global_idx`,`data`)}
      }`}else c=`
        let outputIndices = ${a.offsetToIndices(`global_idx * ${s}`)};
        let inputOffset = ${n.broadcastedIndicesToOffset(`outputIndices`,a)};
        let data = ${a.type.value}(${n.getByOffset(`inputOffset / ${o}`)});
        ${a.setByOffset(`global_idx`,`data`)}
      }`;return`
    ${e.registerUniform(`vec_size`,`u32`).declareVariables(n,a)}
    ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.vec_size`)}
    ${c}`},u=[{type:12,data:c},...W(t,r)];return{name:`Expand`,shaderCache:{hint:`${r.length};${o}${s}`,inputDependencies:[`rank`]},getShaderSource:l,getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:u})}},$o=e=>{Yo(e.inputs),e.compute(Qo(e.inputs),{inputs:[0]})}}),ts,ns,rs=c(()=>{L(),B(),Y(),Yi(),ts=e=>{let t=e[0].dataType,n=z.size(e[0].dims),r=z.size(e[1].dims),i=r%4==0;return{name:`FastGeluWithBias`,shaderCache:{hint:`${i}`,inputDependencies:[`type`,`type`]},getShaderSource:e=>{let n=q(`x`,t,[1],4),r=q(`bias`,t,[1],4),a=J(`y`,t,[1],4),o=[{name:`output_vec_size`,type:`u32`},{name:`bias_size`,type:`u32`}],s=e=>`
      let bias${e}_offset: u32 = (global_idx * 4 + ${e}) % uniforms.bias_size;
      let bias${e} = ${r.getByOffset(`bias${e}_offset / 4`)}[bias${e}_offset % 4];`,c=i?`
      let bias = ${r.getByOffset(`global_idx % (uniforms.bias_size / 4)`)};`:`${s(0)}${s(1)}${s(2)}${s(3)}
      let bias = ${n.type.value}(bias0, bias1, bias2, bias3);`;return`${e.registerUniforms(o).declareVariables(n,r,a)}

    ${Vi(Tn(t))}

    ${e.mainStart(Cn)}
      ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_vec_size`)}

      let x = ${n.getByOffset(`global_idx`)};
      ${c}
      let x_in = x + bias;
      ${a.setByOffset(`global_idx`,Hi(`x_in`))}
    }`},getRunData:e=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],programUniforms:[{type:12,data:Math.ceil(n/4)},{type:12,data:r}],dispatchGroup:{x:Math.ceil(n/Cn/4)}})}},ns=e=>{e.inputs.length<2||z.size(e.inputs[1].dims)===0?Ui(e):e.compute(ts(e.inputs))}}),is,as,os,ss,cs=c(()=>{L(),B(),H(),Y(),is=e=>{if(!e||e.length!==2)throw Error(`Gather requires 2 inputs.`)},as=(e,t)=>{let n=e[0].dims,r=e[1].dims,i=n.length,a=z.normalizeAxis(t.axis,i),o=n.slice(0);o.splice(a,1,...r);let s=n[a],c=e[0].dataType===9?4:1,l=Math.ceil(z.size(o)/c),u=[{type:12,data:l},{type:6,data:s},{type:12,data:a},...W(e[0].dims,e[1].dims,o)];return{name:`Gather`,shaderCache:{hint:t.cacheKey,inputDependencies:[`rank`,`rank`]},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:u}),getShaderSource:t=>{let n=q(`data`,e[0].dataType,e[0].dims.length,c),s=q(`inputIndices`,e[1].dataType,e[1].dims.length),l=J(`output`,e[0].dataType,o.length,c),u=e=>{let t=r.length,c=`var indicesIndices${e}  = ${s.type.indices}(0);`;for(let n=0;n<t;n++)c+=`${t>1?`indicesIndices${e}[${n}]`:`indicesIndices${e}`} = ${o.length>1?`outputIndices${e}[uniforms.axis + ${n}]`:`outputIndices${e}`};`;c+=`
          var idx${e} = ${s.getByIndices(`indicesIndices${e}`)};
          if (idx${e} < 0) {
            idx${e} = idx${e} + uniforms.axisDimLimit;
          }
          var dataIndices${e} : ${n.type.indices};
        `;for(let n=0,r=0;n<i;n++)n===a?(c+=`${i>1?`dataIndices${e}[${n}]`:`dataIndices${e}`} = u32(idx${e});`,r+=t):(c+=`${i>1?`dataIndices${e}[${n}]`:`dataIndices${e}`} = ${o.length>1?`outputIndices${e}[${r}]`:`outputIndices${e}`};`,r++);return c},d;if(e[0].dataType===9){let e=(e,t,r=``)=>`
          let outputIndices${t} = ${l.offsetToIndices(`outputOffset + ${t}u`)};
          ${u(t)};
          let offset${t} = ${n.indicesToOffset(`dataIndices${t}`)};
          let index${t} = offset${t} / 4u;
          let component${t} = offset${t} % 4u;
          ${e}[${t}] = ${r}(${n.getByOffset(`index${t}`)}[component${t}]);
        `;d=`
        let outputOffset = global_idx * ${c};
        var value = vec4<u32>(0);
        ${e(`value`,0,`u32`)}
        ${e(`value`,1,`u32`)}
        ${e(`value`,2,`u32`)}
        ${e(`value`,3,`u32`)}
        ${l.setByOffset(`global_idx`,`value`)}
      `}else d=`
      let outputIndices = ${l.offsetToIndices(`global_idx`)};
      ${u(``)};
      let value = ${n.getByIndices(`dataIndices`)};
      ${l.setByOffset(`global_idx`,`value`)};
      `;return`
      ${t.registerUniform(`outputSize`,`u32`).registerUniform(`axisDimLimit`,`i32`).registerUniform(`axis`,`u32`).declareVariables(n,s,l)}
      ${t.mainStart()}
        ${t.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
        ${d}
      }`}}},os=e=>V({axis:e.axis}),ss=(e,t)=>{let n=e.inputs;is(n),e.compute(as(e.inputs,t))}}),ls,us,ds,fs=c(()=>{L(),B(),Y(),ls=(e,t,n,r,i,a,o,s,c)=>{let l=[{type:12,data:a},{type:12,data:r},{type:12,data:i},{type:12,data:n},{type:12,data:o},{type:12,data:s},{type:12,data:c}],u=[a];return l.push(...W(t.dims,u)),e.compute({name:`computeSliceOffsets`,shaderCache:{hint:`${i.length}_${n.length}`,inputDependencies:[`rank`]},getRunData:()=>({outputs:[{dims:u,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:l}),getShaderSource:e=>{let r=[q(`indices_data`,t.dataType,t.dims.length),J(`input_slice_offsets_data`,12,1,1)],a=[{name:`output_size`,type:`u32`},{name:`batch_dims`,type:`u32`},{name:`input_dims`,type:`u32`,length:i.length},{name:`sizes_from_slice_dims_data`,type:`u32`,length:n.length},{name:`num_slices_per_batch`,type:`u32`},{name:`input_batch_stride`,type:`u32`},{name:`num_slice_dims`,type:`u32`}];return`
  ${e.registerUniforms(a).declareVariables(...r)}
  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${i.length===1?`index += i32(uniforms.input_dims);`:`index += i32(uniforms.input_dims[input_dim_idx]);`}
      }
      ${n.length===1?`relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);`:`relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);`}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`}},{inputs:[t],outputs:[-1]})[0]},us=(e,t)=>{let n=e.inputs,r=n[0].dims,i=n[0].dataType,a=n[1].dims,o=a[a.length-1],s=z.sizeToDimension(a,a.length-1),c=z.sizeFromDimension(r,t.batchDims+o),l=z.sizeToDimension(r,t.batchDims),u=z.sizeFromDimension(r,t.batchDims),d=s/l,f=Array(o),p=c;for(let e=0;e<o;++e)f[o-1-e]=p,p*=r[t.batchDims+o-1-e];let m=ls(e,n[1],f,t.batchDims,r,s,d,u,o),h=t.batchDims+o;if(h>r.length)throw Error(`last dimension of indices must not be larger than rank of input tensor`);let g=a.slice(0,-1).concat(r.slice(h)),_=z.size(g),v=[{type:12,data:_},{type:12,data:c},...W(n[0].dims,m.dims,g)];e.compute({name:`GatherND`,shaderCache:{hint:t.cacheKey,inputDependencies:[`rank`,`rank`]},getRunData:()=>({outputs:[{dims:g,dataType:i}],dispatchGroup:{x:Math.ceil(_/64)},programUniforms:v}),getShaderSource:e=>{let t=q(`data`,n[0].dataType,n[0].dims.length),r=q(`slice_offsets`,12,m.dims.length),i=J(`output`,n[0].dataType,g.length);return`
          ${e.registerUniform(`output_size`,`u32`).registerUniform(`slice_size`,`u32`).declareVariables(t,r,i)}
            ${e.mainStart()}
            ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`}},{inputs:[n[0],m]})},ds=e=>({batchDims:e.batch_dims,cacheKey:``})}),ps,ms,hs,gs,_s=c(()=>{L(),B(),H(),Y(),ps=(e,t)=>{if(e.length<3||e.length>4)throw Error(`GatherBlockQuantized requires 3 or 4 inputs.`);let n=z.normalizeAxis(t.quantizeAxis,e[0].dims.length),r=t.blockSize,i=e[0],a=e[2],o=e.length===4?e[3]:void 0;if(a.dims.length!==i.dims.length||!i.dims.map((e,t)=>t===n?Math.ceil(e/r)===a.dims[t]:e===a.dims[t]).reduce((e,t)=>e&&t,!0))throw Error(`Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.`);if(o){if(o.dataType!==i.dataType)throw Error(`Zero point must have the same data type as the input tensor.`);if(o.dims.length!==a.dims.length||!o.dims.map((e,t)=>e===a.dims[t]).reduce((e,t)=>e&&t,!0))throw Error(`Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.`)}},ms=(e,t)=>{let n=e[0].dims,r=e[1].dims,i=n.length,a=z.normalizeAxis(t.gatherAxis,i),o=z.normalizeAxis(t.quantizeAxis,i),s=n.slice(0);s.splice(a,1,...r);let c=z.size(s),l=e[2].dataType,u=e[0].dataType===22,d=[{type:12,data:c},{type:12,data:o},{type:12,data:a},{type:12,data:t.blockSize},...W(...e.map((e,t)=>e.dims),s)];return{name:`GatherBlockQuantized`,shaderCache:{hint:`${t.cacheKey};${e.filter((e,t)=>t!==1).map(e=>e.dims.join(`_`)).join(`;`)}`,inputDependencies:Array.from({length:e.length},(e,t)=>`rank`)},getRunData:()=>({outputs:[{dims:s,dataType:l}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:d}),getShaderSource:t=>{let i=q(`data`,e[0].dataType,e[0].dims.length),o=q(`inputIndices`,e[1].dataType,e[1].dims.length),c=q(`scales`,e[2].dataType,e[2].dims.length),d=e.length>3?q(`zeroPoint`,e[3].dataType,e[3].dims.length):void 0,f=J(`output`,l,s.length),p=[i,o,c];return d&&p.push(d),`
        ${t.registerUniforms([{name:`output_size`,type:`u32`},{name:`quantize_axis`,type:`u32`},{name:`gather_axis`,type:`u32`},{name:`block_size`,type:`u32`}]).declareVariables(...p,f)}
        ${t.mainStart()}
        let output_indices = ${f.offsetToIndices(`global_idx`)};
        var indices_indices = ${o.type.indices}(0);
        ${r.length>1?`
          for (var i: u32 = 0; i < ${r.length}; i++) {
            let index = ${f.indicesGet(`output_indices`,`uniforms.gather_axis + i`)};
            ${o.indicesSet(`indices_indices`,`i`,`index`)};
          }`:`indices_indices = ${f.indicesGet(`output_indices`,`uniforms.gather_axis`)};`};
        var data_indices = ${i.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${f.indicesGet(`output_indices`,`i`)};
          ${i.indicesSet(`data_indices`,`i`,`index`)};
        }
        var index_from_indices = ${o.getByIndices(`indices_indices`)};
        if (index_from_indices < 0) {
          index_from_indices += ${n[a]};
        }
        ${i.indicesSet(`data_indices`,`uniforms.gather_axis`,`u32(index_from_indices)`)};
        for (var i = uniforms.gather_axis + 1; i < ${s.length}; i++) {
          let index = ${f.indicesGet(`output_indices`,`i + ${r.length} - 1`)};
          ${i.indicesSet(`data_indices`,`i`,`index`)};
        }
        let data_offset = ${i.indicesToOffset(`data_indices`)};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${i.getByOffset(`data_offset / 8`)};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${u?`unpack4xI8`:`unpack4xU8`}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${c.indicesGet(`data_indices`,`uniforms.quantize_axis`)} / uniforms.block_size;
        ${c.indicesSet(`scale_indices`,`uniforms.quantize_axis`,`quantize_axis_index`)};
        var scale = ${c.getByIndices(`scale_indices`)};
        ${d?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${d.indicesToOffset(`zero_point_indices`)};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${d.getByOffset(`zero_point_offset / 8`)};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${u?`unpack4xI8`:`unpack4xU8`}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:`var zero_point = 0`};
        let dequantized_data = ${Tn(l)}(quantized_data - zero_point) * scale;
        ${f.setByOffset(`global_idx`,`dequantized_data`)};
    }`}}},hs=(e,t)=>{let n=e.inputs;ps(n,t),e.compute(ms(e.inputs,t))},gs=e=>V({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),vs,ys,bs,xs,Ss=c(()=>{L(),B(),H(),Y(),vs=e=>{if(!e||e.length!==2)throw Error(`GatherElements requires 2 inputs.`);if(e[0].dims.length<1)throw Error(`GatherElements requires that the data input be rank >= 1.`);if(e[0].dims.length!==e[1].dims.length)throw Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},ys=(e,t)=>{let n=e[0].dims,r=e[0].dataType,i=n.length,a=e[1].dims,o=e[1].dataType,s=z.normalizeAxis(t.axis,i),c=n[s],l=a.slice(0),u=z.size(l),d=q(`input`,r,i),f=q(`indicesInput`,o,a.length),p=J(`output`,r,l.length),m=[{type:12,data:u},{type:6,data:c},{type:12,data:s}];return m.push(...W(n,a,l)),{name:`GatherElements`,shaderCache:{inputDependencies:[`rank`,`rank`]},getRunData:()=>({outputs:[{dims:l,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:m}),getShaderSource:e=>`
      ${e.registerUniform(`outputSize`,`u32`).registerUniform(`axisDimLimit`,`i32`).registerUniform(`axis`,`u32`).declareVariables(d,f,p)}
      ${e.mainStart()}
      ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}

      let outputIndices = ${p.offsetToIndices(`global_idx`)};

      var idx = ${f.getByOffset(`global_idx`)};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${d.type.indices}(outputIndices);
      ${d.indicesSet(`inputIndices`,`uniforms.axis`,`u32(idx)`)};
      let value = ${d.getByIndices(`inputIndices`)};

      ${p.setByOffset(`global_idx`,`value`)};
  }`}},bs=e=>V({axis:e.axis}),xs=(e,t)=>{let n=e.inputs;vs(n),e.compute(ys(e.inputs,t))}}),Cs,ws,Ts,Es,Ds=c(()=>{L(),B(),Y(),Cs=e=>{if(!e)throw Error(`Input is missing`);if(e.length<2||e.length>3)throw Error(`Invaid input number.`);if(e.length===3&&e[2].dims.length>2)throw Error(`Invalid input shape of C`);if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw Error(`Input types are mismatched`)},ws=(e,t)=>{let n=e[0].dims.slice(),r=e[1].dims.slice(),[i,a,o]=Ut.getShapeOfGemmResult(n,t.transA,r,t.transB,e.length===3?e[2].dims:void 0),s=[i,a];if(!s)throw Error(`Can't use gemm on the given tensors`);let c=Math.ceil(a/16),l=Math.ceil(i/16);z.size(s);let u=[{type:12,data:c},{type:12,data:i},{type:12,data:a},{type:12,data:o},{type:1,data:t.alpha},{type:1,data:t.beta}],d=[`type`,`type`];return e.length===3&&(u.push(...W(e[2].dims)),d.push(`rank`)),u.push(...W(s)),{name:`GemmShared`,shaderCache:{hint:`${t.cacheKey}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:s,dataType:e[0].dataType}],dispatchGroup:{x:c*l},programUniforms:u}),getShaderSource:n=>{let r=q(`a`,e[0].dataType,e[0].dims),i=q(`b`,e[1].dataType,e[1].dims),a=null,o=[r,i];e.length===3&&(a=q(`c`,e[2].dataType,e[2].dims.length),o.push(a));let c=J(`output`,e[0].dataType,s.length);o.push(c);let l=[{name:`num_tile_n`,type:`u32`},{name:`M`,type:`u32`},{name:`N`,type:`u32`},{name:`K`,type:`u32`},{name:`alpha`,type:`f32`},{name:`beta`,type:`f32`}],u=``,d=``;t.transA&&t.transB?(d=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${r.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${i.type.value}(0);
      }
      `,u=`value += tile_a[k][local_id.y] * tile_b[local_id.x][k];`):t.transA&&!t.transB?(d=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${r.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${i.type.value}(0);
      }
      `,u=`value += tile_a[k][local_id.y] * tile_b[k][local_id.x];`):!t.transA&&t.transB?(d=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${r.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${i.type.value}(0);
      }
      `,u=`value += tile_a[local_id.y][k] * tile_b[local_id.x][k];`):!t.transA&&!t.transB&&(d=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${r.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${i.type.value}(0);
      }
      `,u=`value += tile_a[local_id.y][k] * tile_b[k][local_id.x];`);let f=t.alpha===1?``:`value *= uniforms.alpha;`;return`
  ${n.registerUniforms(l).declareVariables(...o)}
  var<workgroup> tile_a: array<array<${r.type.storage}, 16>, 16>;
  var<workgroup> tile_b: array<array<${i.type.storage}, 16>, 16>;
  ${n.mainStart([16,16,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * 16;
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * 16;
    let num_tiles = (uniforms.K - 1) / 16 + 1;
    var k_start = 0u;
    var value = ${c.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${d}
      k_start = k_start + 16;
      workgroupBarrier();

      for (var k: u32 = 0u; k < 16; k++) {
        ${u}
      }
      workgroupBarrier();
    }

    ${f}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${a==null?``:`let cOffset = ${a.broadcastedIndicesToOffset(`vec2(m, n)`,c)}; value += ${c.type.value}(uniforms.beta) * ${a.getByOffset(`cOffset`)};`}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`}}},Ts=e=>({transA:e.transA,transB:e.transB,alpha:e.alpha,beta:e.beta,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}),Es=(e,t)=>{Cs(e.inputs),e.compute(ws(e.inputs,t))}}),Os,ks,As,js,Ms,Ns,Ps,Fs,Is,Ls,Rs,zs,Bs,Vs,Hs=c(()=>{L(),B(),H(),Y(),[Os,ks,As,js]=[0,1,2,3],Ms=e=>{if(e[0].dims.length!==4)throw Error(`only 4-D tensor is supported.`);if(e[0].dims.length!==e[1].dims.length)throw Error(`input dimensions must be equal to grid dimensions`);if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw Error(`grid batch size must match input batch size`)},Ns=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,Ps=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,Fs=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,Is=e=>`
  ${e.paddingMode===`reflection`?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:``}
`,Ls=(e,t,n)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${Os}] = batch;
     indices[${ks}] = channel;`+(()=>{switch(n.paddingMode){case`zeros`:return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${As}] = u32(r);
            indices[${js}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case`border`:return`
          indices[${As}] = u32(clamp(r, 0, H - 1));
          indices[${js}] = u32(clamp(c, 0, W - 1));
        `;case`reflection`:return`
          indices[${As}] = gs_reflect(r, border[1], border[3]);
          indices[${js}] = gs_reflect(c, border[0], border[2]);
        `;default:throw Error(`padding mode ${n.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices(`indices`)};
  }
`,Rs=(e,t,n)=>(()=>{switch(n.mode){case`nearest`:return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${Os}], indices[${ks}], border);
        `;case`bilinear`:return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${Os}], indices[${ks}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${Os}], indices[${ks}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${Os}], indices[${ks}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${Os}], indices[${ks}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case`bicubic`:return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${Os}], indices[${ks}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw Error(`mode ${n.mode} is not supported`)}})()+`${e.setByOffset(`global_idx`,`result`)}`,zs=(e,t)=>{let n=q(`x`,e[0].dataType,e[0].dims.length),r=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],i=q(`grid`,e[1].dataType,r.length,2),a=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format===`NHWC`&&(a=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[Os,ks,As,js]=[0,3,1,2]);let o=J(`output`,e[0].dataType,a.length),s=n.type.value,c=[{type:12,data:z.size(a)},...W(e[0].dims,r,a)];return{name:`GridSample`,shaderCache:{hint:`${t.cacheKey}`,inputDependencies:[`type`,`type`]},getRunData:e=>{let t=z.size(a);return{outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(t/64)},programUniforms:c}},getShaderSource:e=>`
  ${e.registerUniform(`output_size`,`u32`).declareVariables(n,i,o)}
  ${Ns}
  ${Ps(s)}
  ${Fs(t)}
  ${Is(t)}
  ${Ls(n,s,t)}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
      let H_in = i32(uniforms.x_shape[${As}]);
      let W_in = i32(uniforms.x_shape[${js}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${o.offsetToIndices(`global_idx`)};
      var grid_indices = vec3<u32>(indices[${Os}], indices[${As}], indices[${js}]);
      let nxy = ${i.getByIndices(`grid_indices`)};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${Rs(o,s,t)}
  }`}},Bs=(e,t)=>{Ms(e.inputs),e.compute(zs(e.inputs,t))},Vs=e=>V({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),Us,Ws,Gs,Ks,qs,Js,Ys,Xs=c(()=>{L(),B(),H(),dn(),Yr(),Y(),Un(),Us=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,Ws=(e,t)=>{let n=e[0],r=Us(e,1),i=Us(e,2),a=Us(e,3),o=Us(e,4),s=Us(e,5),c=Us(e,6),l=Us(e,7);if(n.dims.length!==3&&n.dims.length!==5)throw Error(`Input query is expected to have 3 or 5 dimensions`);let u=n.dims[0],d=n.dims[1],f=n.dims.length===3?n.dims[2]:t.numHeads*n.dims[4],p=d,m=0,h=0,g=Math.floor(f/t.numHeads);if(c&&l&&z.size(c.dims)&&z.size(l.dims)){if(c.dims.length!==4)throw Error(`Input "past_key" is expected to have 4 dimensions`);if(c.dims[0]!==u||c.dims[1]!==t.numHeads||c.dims[3]!==g)throw Error(`Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)`);if(l.dims[0]!==u||l.dims[1]!==t.numHeads||l.dims[3]!==g)throw Error(`Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)`);if(c.dims[2]!==l.dims[2])throw Error(`Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)`);if(l.dims.length!==4)throw Error(`Input "past_value" is expected to have 4 dimensions`);m=c.dims[2],h=c.dims[2]}else if(c&&z.size(c.dims)||l&&z.size(l.dims))throw Error(`Input "past_key" and "past_value" shall be both present or both absent`);let _;if(r&&z.size(r.dims)>0){if(n.dims.length!==3)throw Error(`Input "query" is expected to have 3 dimensions when key is given`);if(r.dims.length<3||r.dims.length>5)throw Error(`Input "key" is expected to have 3, 4, or 5 dimensions`);if(n.dims[0]!==r.dims[0])throw Error(`Input "query" and "key" shall have same dim 0 (batch size)`);if(r.dims.length===3){if(r.dims[2]!==n.dims[2])throw Error(`Input "query" and "key" shall have same dim 2 (hidden_size)`);_=2,p=r.dims[1]}else if(r.dims.length===5){if(r.dims[2]!==t.numHeads||r.dims[3]!==2||r.dims[4]!==g)throw Error(`Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv`);if(i)throw Error(`Expect "value" be none when "key" has packed kv format.`);_=5,p=r.dims[1]}else{if(r.dims[1]!==t.numHeads||r.dims[3]!==g)throw Error(`Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key`);_=0,p=r.dims[2]}}else{if(n.dims.length!==5)throw Error(`Input "query" is expected to have 5 dimensions when key is empty`);if(n.dims[2]!==t.numHeads||n.dims[3]!==3)throw Error(`Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv`);_=3}if(a&&z.size(a.dims)>0){if(a.dims.length!==1)throw Error(`Input "bias" is expected to have 1 dimension`);if(r&&r.dims.length===5&&r.dims[3]===2)throw Error(`bias is not allowed for packed kv.`)}let v=m+p,y=0;if(o&&z.size(o.dims)>0){y=8;let e=o.dims;throw e.length===1?e[0]===u?y=1:e[0]===3*u+2&&(y=3):e.length===2&&e[0]===u&&e[1]===v&&(y=5),Error(y===8?`Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)`:`Mask not supported`)}let b=!1,x=f;if(i&&z.size(i.dims)>0){if(i.dims.length!==3&&i.dims.length!==4)throw Error(`Input "value" is expected to have 3 or 4 dimensions`);if(n.dims[0]!==i.dims[0])throw Error(`Input "query" and "value" shall have same dim 0 (batch_size)`);if(i.dims.length===3){if(p!==i.dims[1])throw Error(`Input "key" and "value" shall have the same dim 1 (kv_sequence_length)`);x=i.dims[2]}else{if(p!==i.dims[2])throw Error(`Input "key" and "value" shall have the same dim 2 (kv_sequence_length)`);x=i.dims[1]*i.dims[3],b=!0}}if(o&&z.size(o.dims)>0)throw Error(`Key padding mask is not supported`);if(s&&z.size(s.dims)>0){if(s.dims.length!==4)throw Error(`Input "attention_bias" is expected to have 4 dimensions`);if(s.dims[0]!==u||s.dims[1]!==t.numHeads||s.dims[2]!==d||s.dims[3]!==v)throw Error(`Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)`)}return{batchSize:u,sequenceLength:d,pastSequenceLength:m,kvSequenceLength:p,totalSequenceLength:v,maxSequenceLength:h,inputHiddenSize:0,hiddenSize:f,vHiddenSize:x,headSize:g,vHeadSize:Math.floor(x/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:b,qkvFormat:_}},Gs=e=>V({...e}),Ks=V({perm:[0,2,1,3]}),qs=(e,t,n,r,i,a,o)=>{let s=[r,i,a],c=z.size(s),l=[{type:12,data:c},{type:12,data:o},{type:12,data:a}];return e.compute({name:`MultiHeadAttentionAddBias`,shaderCache:{inputDependencies:[`type`,`type`]},getRunData:()=>({outputs:[{dims:s,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:l}),getShaderSource:e=>{let r=J(`qkv_with_bias`,t.dataType,s),i=q(`qkv`,t.dataType,s),a=q(`bias`,n.dataType,s);return`
  ${e.registerUniforms([{name:`output_size`,type:`u32`},{name:`bias_offset`,type:`u32`},{name:`hidden_size`,type:`u32`}]).declareVariables(i,a,r)}
  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`}},{inputs:[t,n],outputs:[-1]})[0]},Js=(e,t,n,r,i,a,o,s)=>{let c=a;if(o&&z.size(o.dims)>0){if(r===1)throw Error(`AddBiasReshape is not implemented. Please export your model with packed QKV or KV`);return c=qs(e,a,o,t,r,n*i,s),c=c.reshape([t,r,n,i]),n===1||r===1?c:e.compute(Bn(c,Ks.perm),{inputs:[c],outputs:[-1]})[0]}else return a.dims.length===3&&(c=a.reshape([t,r,n,i])),n===1||r===1?c:e.compute(Bn(c,Ks.perm),{inputs:[c],outputs:[-1]})[0]},Ys=(e,t)=>{let n=Ws(e.inputs,t),r=e.inputs[0],i=Us(e.inputs,1),a=Us(e.inputs,2),o=Us(e.inputs,3),s=Us(e.inputs,4),c=Us(e.inputs,5),l=Us(e.inputs,6),u=Us(e.inputs,7);if(r.dims.length===5)throw Error(`Packed QKV is not implemented`);if((i==null?void 0:i.dims.length)===5)throw Error(`Packed KV is not implemented`);let d=i&&a&&i.dims.length===4&&a.dims.length===4,f=Js(e,n.batchSize,n.numHeads,n.sequenceLength,n.headSize,r,o,0);if(d)return Kr(e,f,i,a,s,void 0,l,u,c,n);if(!i||!a)throw Error(`key and value must be provided`);let p=Js(e,n.batchSize,n.numHeads,n.kvSequenceLength,n.headSize,i,o,n.hiddenSize),m=Js(e,n.batchSize,n.numHeads,n.kvSequenceLength,n.vHeadSize,a,o,2*n.hiddenSize);Kr(e,f,p,m,s,void 0,l,u,c,n)}}),Zs,Qs,$s,ec,tc,nc,rc,ic=c(()=>{L(),B(),H(),Y(),Zs=e=>{if(!e||e.length<1)throw Error(`too few inputs`)},Qs=(e,t)=>{let n=[],r=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(e=>n.push(Number(e))),r=n.length),V({numOutputs:r,axis:t.axis,splitSizes:n})},$s=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${K(`uniforms.size_in_split_axis`,`i`,e)}) {
        return i;
    }
    }
    return ${e}u;
}`,ec=e=>{let t=e.length,n=[];for(let r=0;r<t;++r){let i=e[r].setByIndices(`indices`,`input[global_idx]`);t===1?n.push(i):r===0?n.push(`if (output_number == ${r}u) { ${i} }`):r===t-1?n.push(`else { ${i} }`):n.push(`else if (output_number == ${r}) { ${i} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${n.join(`
`)}
      }`},tc=(e,t)=>{let n=e[0].dims,r=z.size(n),i=e[0].dataType,a=z.normalizeAxis(t.axis,n.length),o=Array(t.numOutputs),s=q(`input`,i,n.length),c=Array(t.numOutputs),l=[],u=[],d=0,f=[{type:12,data:r}];for(let r=0;r<t.numOutputs;r++){d+=t.splitSizes[r],c[r]=d;let s=n.slice();s[a]=t.splitSizes[r],u.push(s),o[r]=J(`output${r}`,i,s.length),l.push({dims:u[r],dataType:e[0].dataType})}return f.push({type:12,data:c},...W(n,...u)),{name:`Split`,shaderCache:{hint:t.cacheKey,inputDependencies:[`rank`]},getShaderSource:e=>`
  ${e.registerUniform(`input_size`,`u32`).registerUniform(`size_in_split_axis`,`u32`,c.length).declareVariables(s,...o)}
  ${$s(c.length)}
  ${ec(o)}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.input_size`)}

    var indices = ${s.offsetToIndices(`global_idx`)};
    var index = ${s.indicesGet(`indices`,a)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${K(`uniforms.size_in_split_axis`,`output_number - 1u`,c.length)};
      ${s.indicesSet(`indices`,a,`index`)};
    }
    writeBufferData(output_number, indices, global_idx);
  }`,getRunData:()=>({outputs:l,dispatchGroup:{x:Math.ceil(r/64)},programUniforms:f})}},nc=(e,t)=>{Zs(e.inputs);let n=e.inputs.length===1?t:Qs(e.inputs,t);e.compute(tc(e.inputs,n),{inputs:[0]})},rc=e=>{let t=e.axis,n=e.splitSizes,r=e.numOutputs<0?n.length:e.numOutputs;if(r!==n.length)throw Error(`numOutputs and splitSizes length must be equal`);return V({axis:t,numOutputs:r,splitSizes:n})}}),ac,oc,sc,cc=c(()=>{L(),B(),H(),Y(),ac=(e,t)=>{let[n,r,i,a]=e,{numHeads:o,rotaryEmbeddingDim:s}=t;if(n.dims.length!==3&&n.dims.length!==4)throw Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${n.dims.length}`);if(!z.areEqual(r.dims,[])&&!z.areEqual(r.dims,[1])&&r.dims.length!==2)throw Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${r.dims.length}`);if(i.dims.length!==2)throw Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${i.dims.length}`);if(a.dims.length!==2)throw Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(!z.areEqual(i.dims,a.dims))throw Error(`Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape`);if(s>0&&o===0)throw Error(`num_heads must be provided if rotary_embedding_dim is specified`);let c=n.dims[0],l=n.dims[n.dims.length-2],u=i.dims[0],d=z.sizeFromDimension(n.dims,1)/l,f=s===0?i.dims[1]*2:d/o;if(s>f)throw Error(`rotary_embedding_dim must be less than or equal to head_size`);if(r.dims.length===2){if(c!==r.dims[0])throw Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${r.dims[0]}`);if(l!==r.dims[1])throw Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${r.dims[1]}`)}if(l>u)throw Error(`Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported`);if(f/2!==i.dims[1]&&s/2!==i.dims[1])throw Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${i.dims[1]}`)},oc=(e,t)=>{let{interleaved:n,numHeads:r,rotaryEmbeddingDim:i,scale:a}=t,o=e[0].dims[0],s=z.sizeFromDimension(e[0].dims,1),c=e[0].dims[e[0].dims.length-2],l=s/c,u=e[2].dims[1],d=i===0?u*2:l/r,f=[o,c,l/d,d-u],p=z.computeStrides(f),m=[{type:1,data:a},{type:12,data:f},{type:12,data:p},...e[0].dims.length===3?Array({type:12,data:[s,l,d,1]}):[],...e[0].dims.length===4?Array({type:12,data:[s,d,c*d,1]}):[],...W(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)];return{name:`RotaryEmbedding`,shaderCache:{hint:V({interleaved:n}).cacheKey,inputDependencies:[`rank`,`rank`,`rank`,`rank`]},getShaderSource:t=>{let r=q(`input`,e[0].dataType,e[0].dims.length),i=q(`position_ids`,e[1].dataType,e[1].dims.length),a=q(`cos_cache`,e[2].dataType,e[2].dims.length),o=q(`sin_cache`,e[3].dataType,e[3].dims.length),s=J(`output`,e[0].dataType,e[0].dims.length);return t.registerUniforms([{name:`scale`,type:`f32`},{name:`global_shape`,type:`u32`,length:f.length},{name:`global_strides`,type:`u32`,length:p.length},{name:`input_output_strides`,type:`u32`,length:p.length}]),`
        ${t.declareVariables(r,i,a,o,s)}

        ${t.mainStart(Cn)}
          let half_rotary_emb_dim = uniforms.${a.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${t.guardAgainstOutOfBoundsWorkgroupSizes(`size`)}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${i.broadcastedIndicesToOffset(`bsnh.xy`,J(``,i.type.tensor,2))};
            let position_id =
                u32(${i.getByOffset(`position_ids_idx`)}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${n});
            let j = i + select(half_rotary_emb_dim, 1, ${n});
            let re = ${r.getByOffset(`i`)} * ${a.get(`position_id`,`bsnh[3]`)} -
                ${r.getByOffset(`j`)} * ${o.get(`position_id`,`bsnh[3]`)};
            ${s.setByOffset(`i`,`re`)}
            let im = ${r.getByOffset(`i`)} * ${o.get(`position_id`,`bsnh[3]`)} +
                ${r.getByOffset(`j`)} * ${a.get(`position_id`,`bsnh[3]`)};
            ${s.setByOffset(`j`,`im`)}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${s.setByOffset(`k`,r.getByOffset(`k`))}
          }
        }`},getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(z.size(f)/Cn)},programUniforms:m})}},sc=(e,t)=>{ac(e.inputs,t),e.compute(oc(e.inputs,t))}}),lc,uc,dc,fc,pc,mc=c(()=>{H(),L(),Yr(),Xs(),ic(),Un(),cc(),Y(),lc=(e,t)=>{if(t.doRotary&&e.length<=7)throw Error(`cos_cache and sin_cache inputs are required if do_rotary is specified`);let n=e[0],r=e[1],i=e[2],a=e[3],o=e[4];if(t.doRotary!==0&&e.length<=7)throw Error(`cos_cast and sin_cache are expected if do_rotary attribute is non-zero`);if(t.localWindowSize!==-1)throw Error(`Local attention is not supported`);if(t.softcap!==0)throw Error(`Softcap is not supported`);if(t.rotaryInterleaved!==0)throw Error(`Rotary interleaved is not supported`);if(t.smoothSoftmax)throw Error(`Smooth softmax is not supported`);if(n.dims.length!==3&&n.dims.length!==5)throw Error(`Input query is expected to have 3 or 5 dimensions`);let s=n.dims[0],c=n.dims[1],l=n.dims.length===3?n.dims[2]:t.numHeads*n.dims[4],u=c,d=0,f=!r||r.dims.length===0,p=Math.floor(f?l/(t.numHeads+2*t.kvNumHeads):l/t.numHeads);f&&(l=p*t.numHeads);let m=a&&a.dims.length!==0,h=o&&o.dims.length!==0;if(m&&a.dims.length===4&&a.dims[0]===s&&a.dims[1]!==t.kvNumHeads&&a.dims[2]===t.kvNumHeads&&a.dims[3]===p)throw Error(`BSNH pastKey/pastValue is not supported`);if(m&&h){if(a.dims.length!==4)throw Error(`Input "past_key" is expected to have 4 dimensions`);if(o.dims.length!==4)throw Error(`Input "past_value" is expected to have 4 dimensions`);d=a.dims[2]}else if(m||h)throw Error(`Input "past_key" and "past_value" shall be both present or both absent`);let g=1;if(r&&r.dims.length>0){if(n.dims.length!==3)throw Error(`Input "query" is expected to have 3 dimensions when key is given`);if(r.dims.length<3||r.dims.length>5)throw Error(`Input "key" is expected to have 3, 4, or 5 dimensions`);if(n.dims[0]!==r.dims[0])throw Error(`Input "query" and "key" shall have same dim 0 (batch size)`);if(r.dims.length===3){if(n.dims[2]%r.dims[2]!==0)throw Error(`Dimension 2 of "query" should be a multiple of "key"`);u=r.dims[1]}else if(r.dims.length===5){if(r.dims[2]!==t.numHeads||r.dims[3]!==2||r.dims[4]!==p)throw Error(`Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv`);if(i)throw Error(`Expect "value" be none when "key" has packed kv format.`);u=r.dims[1]}else{if(r.dims[1]!==t.numHeads||r.dims[3]!==p)throw Error(`Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key`);u=r.dims[2]}}else{if(n.dims.length!==3&&n.dims.length!==5)throw Error(`Input "query" is expected to have 3 or 5 dimensions when key is empty`);if(n.dims.length===5&&(n.dims[2]!==t.numHeads||n.dims[3]!==3))throw Error(`Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv`);g=3}let _=!1,v=t.kvNumHeads?p*t.kvNumHeads:l;if(i&&i.dims.length>0){if(i.dims.length!==3&&i.dims.length!==4)throw Error(`Input "value" is expected to have 3 or 4 dimensions`);if(n.dims[0]!==i.dims[0])throw Error(`Input "query" and "value" shall have same dim 0 (batch_size)`);if(i.dims.length===3){if(u!==i.dims[1])throw Error(`Input "key" and "value" shall have the same dim 1 (kv_sequence_length)`);v=i.dims[2]}else{if(u!==i.dims[2])throw Error(`Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)`);v=i.dims[1]*i.dims[3],_=!0}}let y=e.length>4?e[5]:void 0;if(y){if(y.dims.length===0)throw Error(`seqlens_k must be at least 1D, got scalar.`);let e=y.dims.reduce((e,t)=>e*t,1);if(e!==s)throw Error(`seqlens_k must have batch_size (${s}) elements, got ${e}.`);for(let e=0;e<y.dims.length;e++)if(y.dims[e]!==1&&y.dims[e]!==s)throw Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${s}), got dims[${e}] = ${y.dims[e]}.`)}return{batchSize:s,sequenceLength:c,pastSequenceLength:d,kvSequenceLength:u,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:l,vHiddenSize:v,headSize:p,vHeadSize:Math.floor(v/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:0,scale:t.scale,broadcastResPosBias:!1,passPastInKv:_,qkvFormat:g}},uc=V({perm:[0,2,1,3]}),dc=(e,t,n)=>{let r=t,i=n.kvNumHeads;return t.dims.length===3&&n.kvSequenceLength!==0&&(r=t.reshape([n.batchSize,n.kvSequenceLength,i,n.headSize]),r=e.compute(Bn(r,uc.perm),{inputs:[r],outputs:[-1]})[0]),r},fc=(e,t,n,r)=>{let i=[`type`,`type`],a=[e*t],o=e*t,s=[{type:12,data:o},{type:12,data:t},{type:12,data:e}];return{name:`GeneratePositionIds`,shaderCache:{hint:`${e};${t}`,inputDependencies:i},getRunData:()=>({outputs:[{dims:a,dataType:7}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:s}),getShaderSource:e=>{let t=q(`seq_lens`,n.dataType,n.dims),i=q(`total_seq_lens`,r.dataType,r.dims),o=J(`pos_ids`,7,a);return`
  ${e.registerUniforms([{name:`output_size`,type:`u32`},{name:`sequence_length`,type:`u32`},{name:`batch_size`,type:`u32`}]).declareVariables(t,i,o)}
  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
    let total_sequence_length = u32(${i.getByOffset(`0`)});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${t.getByOffset(`batch_idx`)};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${o.setByOffset(`global_idx`,`pos_id`)}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${o.setByOffset(`global_idx`,`pos_id`)}
    } else if (global_idx < uniforms.batch_size) {
      ${o.setByOffset(`global_idx`,`seqlen`)}
    };
  }
  `}}},pc=(e,t)=>{var n;let r=lc(e.inputs,t);if(e.inputs[0].dims.length===5)throw Error(`Packed QKV is not implemented`);if(((n=e.inputs[1])==null?void 0:n.dims.length)===5)throw Error(`Packed KV is not implemented`);let i=e.inputs[0],a=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,o=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,s=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,c=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,l=e.inputs.length>4?e.inputs[5]:void 0,u=e.inputs.length>5?e.inputs[6]:void 0,d=r.kvNumHeads?r.kvNumHeads:r.numHeads,f=V({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,d*r.headSize,d*r.headSize]}),[p,m,h]=!a&&!o?e.compute(tc([i],f),{inputs:[i],outputs:[-1,-1,-1]}):[i,a,o],g,_;if(t.doRotary){let n=e.compute(fc(r.batchSize,r.sequenceLength,l,u),{inputs:[l,u],outputs:[-1]})[0],i=e.inputs[7],a=e.inputs[8],o=V({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),s=[p,n,i,a],c=[-1];g=e.compute(oc(s,o),{inputs:s,outputs:c})[0],s.splice(0,1,m);let d=V({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});_=e.compute(oc(s,d),{inputs:s,outputs:c})[0]}let v=Js(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?g:p,void 0,0),y=dc(e,t.doRotary?_:m,r),b=dc(e,h,r);Kr(e,v,y,b,void 0,void 0,s,c,void 0,r,l,u)}}),hc,gc,_c,vc,yc=c(()=>{L(),B(),Un(),Y(),hc=(e,t,n,r,i,a,o,s)=>{let c=G(a),l=c===1?`f32`:`vec${c}f`,u=c===1?`vec2f`:`mat2x${c}f`,d=i*o,f=64;d===1&&(f=256);let p=[i,o,a/c],m=[i,o,2],h=[`rank`,`type`,`type`],g=[];return g.push(...W(p,m)),e.compute({name:`InstanceNormComputeChannelScaleShift`,shaderCache:{hint:`${c};${s};${f}`,inputDependencies:h},getRunData:()=>({outputs:[{dims:m,dataType:1}],dispatchGroup:{x:d},programUniforms:g}),getShaderSource:e=>{let i=q(`x`,t.dataType,3,c),a=[i,q(`scale`,n.dataType,n.dims),q(`bias`,r.dataType,r.dims),J(`output`,1,3,2)];return`
  var<workgroup> workgroup_shared : array<${u}, ${f}>;
  const workgroup_size = ${f}u;
  ${e.declareVariables(...a)}
  ${e.mainStart(f)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${l}(0);
    var squared_sum = ${l}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${l}(${i.get(`batch`,`channel`,`h`)});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${u}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${On(`workgroup_shared[0][0]`,c)} / f32(hight * ${c});
      let squared_sum_final = ${On(`workgroup_shared[0][1]`,c)} / f32(hight * ${c});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${s}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`}},{inputs:[t,n,r],outputs:[-1]})[0]},gc=(e,t,n)=>{let r=t[0].dims,i=r,a=r[0],o=r[1],s=z.sizeFromDimension(r,2),c=G(s),l=z.size(i)/c,u=hc(e,t[0],t[1],t[2],a,s,o,n.epsilon),d=[a,o,s/c],f=[a,o];e.compute({name:`InstanceNormalization`,shaderCache:{hint:`${c}`,inputDependencies:[`type`,`none`]},getRunData:()=>({outputs:[{dims:i,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:[{type:12,data:l},...W(d,f,d)]}),getShaderSource:e=>{let n=q(`x`,t[0].dataType,d.length,c),r=q(`scale_shift`,1,f.length,2),i=J(`output`,t[0].dataType,d.length,c),a=[n,r,i];return`
  ${e.registerUniform(`output_size`,`u32`).declareVariables(...a)}
  ${e.mainStart()}
  ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
      let outputIndices = ${i.offsetToIndices(`global_idx`)};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${r.getByIndices(`vec2<u32>(batch, channel)`)};
      let value = ${n.getByOffset(`global_idx`)} * ${i.type.value}(scale_shift.x) + ${i.type.value}(scale_shift.y);
      ${i.setByOffset(`global_idx`,`value`)};
  }`}},{inputs:[t[0],u]})},_c=(e,t,n)=>{let r=t[0].dims,i=r,a=r[0],o=r[r.length-1],s=z.sizeFromDimension(r,1)/o,c=G(o),l=z.size(i)/c,u=[{type:12,data:s},{type:12,data:Math.floor(o/c)}],d=[`type`,`type`],f=!1,p=[0,r.length-1];for(let e=0;e<r.length-2;e++)f=f||r[e+1]!==1,p.push(e+1);f=f&&r[r.length-1]!==1;let m=f?e.compute(Bn(e.inputs[0],p),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:r.length},(e,t)=>r[p[t]])),h=hc(e,m,t[1],t[2],a,s,o,n.epsilon);e.compute({name:`InstanceNormalizationNHWC`,shaderCache:{hint:`${c}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:i,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:u}),getShaderSource:e=>{let n=U(t[0].dataType),r=c===1?`vec2f`:`mat${c}x2f`,a=e=>{let t=e===0?`x`:`y`,r=c===1?`f32`:`vec${c}f`;switch(c){case 1:return`${n}(${r}(scale.${t}))`;case 2:return`vec2<${n}>(${r}(scale[0].${t}, scale[1].${t}))`;case 4:return`vec4<${n}>(${r}(scale[0].${t}, scale[1].${t}, scale[2].${t}, scale[3].${t}))`;default:throw Error(`Not supported compoents ${c}`)}},o=q(`input`,t[0].dataType,t[0].dims,c),s=J(`output`,t[0].dataType,i,c);return`
  @group(0) @binding(0) var<storage, read> input : array<${o.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${r}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${s.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${e.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${a(0)}, ${a(1)});
  }`}},{inputs:[t[0],h]})},vc=(e,t)=>{t.format===`NHWC`?_c(e,e.inputs,t):gc(e,e.inputs,t)}}),bc,xc,Sc,Cc=c(()=>{L(),B(),Y(),bc=e=>{if(!e||e.length<2)throw Error(`layerNorm requires at least 2 inputs.`)},xc=(e,t,n)=>{let r=t.simplified,i=e[0].dims,a=e[1],o=!r&&e[2],s=i,c=z.normalizeAxis(t.axis,i.length),l=z.sizeToDimension(i,c),u=z.sizeFromDimension(i,c),d=z.size(a.dims),f=o?z.size(o.dims):0;if(d!==u||o&&f!==u)throw Error(`Size of X.shape()[axis:] == ${u}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${d} and bias size of ${f}`);let p=[];for(let e=0;e<i.length;++e)e<c?p.push(i[e]):p.push(1);let m=G(u),h=[`type`,`type`],g=[{type:12,data:l},{type:1,data:u},{type:12,data:Math.floor(u/m)},{type:1,data:t.epsilon}];o&&h.push(`type`);let _=n>1,v=n>2,y=t=>{let n=U(e[0].dataType),i=[q(`x`,e[0].dataType,e[0].dims,m),q(`scale`,a.dataType,a.dims,m)];return o&&i.push(q(`bias`,o.dataType,o.dims,m)),i.push(J(`output`,e[0].dataType,s,m)),_&&i.push(J(`mean_data_output`,1,p)),v&&i.push(J(`inv_std_output`,1,p)),`
  ${t.registerUniforms([{name:`norm_count`,type:`u32`},{name:`norm_size`,type:`f32`},{name:`norm_size_vectorized`,type:`u32`},{name:`epsilon`,type:`f32`}]).declareVariables(...i)}
  ${t.mainStart()}
    ${t.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.norm_count`)}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${En(`f32`,m)};
    var mean_square_vector = ${En(`f32`,m)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${Dn(n,m,`x[h + offset]`)};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${On(`mean_vector`,m)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${On(`mean_square_vector`,m)} / uniforms.norm_size ${r?``:`- mean * mean`} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${Dn(n,m,`x[j + offset]`)};
      let f32scale = ${Dn(n,m,`scale[j]`)};
      output[j + offset] = ${i[0].type.value}((f32input ${r?``:`- mean`}) * inv_std_dev * f32scale
        ${o?`+ ${Dn(n,m,`bias[j]`)}`:``}
      );
    }

    ${_?`mean_data_output[global_idx] = mean`:``};
    ${v?`inv_std_output[global_idx] = inv_std_dev`:``};
  }`},b=[{dims:s,dataType:e[0].dataType}];return _&&b.push({dims:p,dataType:1}),v&&b.push({dims:p,dataType:1}),{name:`LayerNormalization`,shaderCache:{hint:`${m};${n};${r}`,inputDependencies:h},getRunData:()=>({outputs:b,dispatchGroup:{x:Math.ceil(l/64)},programUniforms:g}),getShaderSource:y}},Sc=(e,t)=>{bc(e.inputs),e.compute(xc(e.inputs,t,e.outputCount))}}),wc,Tc,Ec=c(()=>{B(),Na(),Ha(),wc=e=>{if(!e||e.length!==2)throw Error(`MatMul requires 2 inputs.`);if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw Error(`shared dimension does not match.`)},Tc=e=>{wc(e.inputs);let t=Vt.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw Error(`Can't use matmul on the given tensors`);let n=t[t.length-1],r=e.inputs[0].dims[e.inputs[0].dims.length-1];if(n<8&&r<8)e.compute(Ma(e.inputs,{activation:``},t));else{let i=t[t.length-2],a=z.size(e.inputs[0].dims.slice(0,-2)),o=z.size(e.inputs[1].dims.slice(0,-2));if(a!==1&&i===1&&o===1){let i=e.inputs[0].reshape([1,a,r]),o=e.inputs[1].reshape([1,r,n]),s=[1,a,n],c=[i,o];e.compute(Va(c,{activation:``},t,s),{inputs:c})}else e.compute(Va(e.inputs,{activation:``},t))}}}),Dc,Oc,kc,Ac,jc,Mc=c(()=>{L(),B(),H(),Y(),Dc=(e,t)=>{if(e.length<3||e.length>4)throw Error(`MatMulNBits requires 3 or 4 inputs`);let n=e[0],r=n.dims.length;if(n.dims[r-1]!==t.k)throw Error(`The last dim of input shape does not match the k value`);let i=Math.floor((t.k+t.blockSize-1)/t.blockSize),a=t.blockSize/8*t.bits,o=e[1];if(!z.areEqual(o.dims,[t.n,i,a]))throw Error(`The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize`);let s=e[2].dims;if(z.size(s)!==t.n*i)throw Error(`scales input size error.`);if(e.length===4){let n=e[3].dims,r=t.n*(t.bits===8?i:Math.floor((i*t.bits+7)/8));if(z.size(n)!==r)throw Error(`zeroPoints input size error.`)}},Oc=(e,t)=>{let n=e[0].dims,r=n.length,i=n[r-2],a=t.k,o=t.n,s=n.slice(0,r-2),c=z.size(s),l=e[1].dims[2]/4,u=e[0].dataType,d=G(t.k),f=G(l),p=G(o),m=s.concat([i,o]),h=i>1&&o/p%2==0?2:1,g=z.size(m)/p/h,_=[],v=[c,i,a/d],y=z.convertShape(e[1].dims).slice();y.splice(-1,1,l/f),_.push(...W(v)),_.push(...W(y)),_.push(...W(e[2].dims)),e.length===4&&_.push(...W(z.convertShape(e[3].dims)));let b=[c,i,o/p];return _.push(...W(b)),{name:`MatMulNBits`,shaderCache:{hint:`${t.blockSize};${t.bits};${d};${f};${p};${h};64`,inputDependencies:Array(e.length).fill(`rank`)},getRunData:()=>({outputs:[{dims:m,dataType:u}],dispatchGroup:{x:g},programUniforms:_}),getShaderSource:n=>{let r=v.length,i=q(`a`,e[0].dataType,r,d),a=q(`b`,12,y.length,f),o=q(`scales`,e[2].dataType,e[2].dims.length),s=[i,a,o],c=e.length===4?q(`zero_points`,12,e[3].dims.length):void 0;c&&s.push(c);let u=b.length,m=J(`output`,e[0].dataType,u,p),g=U(e[0].dataType),_=(()=>{switch(d){case 1:return`array<${g}, 8>`;case 2:return`mat4x2<${g}>`;case 4:return`mat2x4<${g}>`;default:throw Error(`${d}-component is not supported.`)}})(),x=Math.floor(32/t.bits),S=Math.floor(x/8),C=()=>{let e=``;for(let n=0;n<S;n++){let r=n*t.bits*4,a=r+t.bits;e+=`
          // reuse a data (pass ${n})
            var input_offset${n>0?n:``} = ${n===0?i.indicesToOffset(`${i.type.indices}(batch, row, word_offset)`):`input_offset`};
            var a_data${n>0?n:``}: ${_};
            for (var j${n>0?n:``}: u32 = 0; j${n>0?n:``} < ${8/d}; j${n>0?n:``}++) {
              a_data${n>0?n:``}[j${n>0?n:``}] = ${i.getByOffset(`input_offset${n>0?n:``}`)};
              input_offset${n>0?n:``}++;
            }
          `;for(let i=0;i<p*h;i++)e+=`
            b_value = ${f===1?`b${i}_data`:`b${i}_data[i]`};
            ${t.bits===2?`{
              let half_word = b_value >> ${n*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${r}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${a}u) & b_mask);`}
            b_quantized_values = ${_}(${Array.from({length:4},(e,t)=>`${g}(b_value_lower[${t}]), ${g}(b_value_upper[${t}])`).join(`, `)});
            b_dequantized_values = ${d===1?`${_}(${Array.from({length:8},(e,t)=>`(b_quantized_values[${t}] - ${c?`zero_point${i}`:`zero_point`}) * scale${i}`).join(`, `)});`:`(b_quantized_values - ${_}(${Array(8).fill(`${c?`zero_point${i}`:`zero_point`}`).join(`,`)})) * scale${i};`};
            workgroup_shared[local_id.x * ${h} + ${Math.floor(i/p)}]${p>1?`[${i%p}]`:``} += ${Array.from({length:8/d},(e,t)=>`${d===1?`a_data${n>0?n:``}[${t}] * b_dequantized_values[${t}]`:`dot(a_data${n>0?n:``}[${t}], b_dequantized_values[${t}])`}`).join(` + `)};
          `}return e},w=()=>{let e=`
            var col_index = col * ${p};
            ${c?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${2**(t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${g}(${(2**(t.bits-1)).toFixed(1)});`}
            `;for(let n=0;n<p*h;n++)e+=`
            let scale${n} = ${o.getByOffset(`col_index * nBlocksPerCol + block`)};
            ${c?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            zero_point_word = ${c.getByOffset(`zero_point_word_index`)} >> zero_point_bits_offset;
            let zero_point${n} = ${g}((zero_point_word) & ${t.bits===2?`0x3u`:`0xFu`});`:``}
            col_index += 1;`;return e},T=()=>{let e=`col_index = col * ${p};`;for(let t=0;t<p*h;t++)e+=`
            let b${t}_data = ${a.getByIndices(`${a.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return e+=`
            var b_value: u32;
            let b_mask: u32 = ${t.bits===2?`0x03030303u`:`0x0F0F0F0Fu`};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${_};
            var b_dequantized_values: ${_};`,e};return`
        var<workgroup> workgroup_shared: array<${m.type.value}, ${h*64}>;
        ${n.declareVariables(...s,m)}
        ${n.mainStart([64,1,1])}
          let output_indices = ${m.offsetToIndices(`(global_idx / 64) * ${h}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += 64) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/d};
            ${w()}
            for (var word: u32 = 0; word < ${l}; word += ${f}) {
              ${T()}
              for (var i: u32 = 0; i < ${f}; i++) {
                ${C()}
                word_offset += ${x/d};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${h}) {
            var output_value: ${m.type.value} = ${m.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < 64u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${h};
            }
            ${m.setByIndices(`${m.type.indices}(batch, row, col + local_id.x)`,`output_value`)};
          }
        }`}}},kc=(e,t)=>{let n=e[0].dims,r=n.length,i=n[r-2],a=t.k,o=t.n,s=n.slice(0,r-2),c=z.size(s),l=e[1].dims[2]/4,u=e[0].dataType,d=G(t.k),f=G(l),p=s.concat([i,o]),m=o%8==0?8:o%4==0?4:1,h=128/m,g=Math.floor(32/t.bits),_=h*f*g,v=_/d,y=_/t.blockSize,b=z.size(p)/m,x=[],S=[c,i,a/d],C=z.convertShape(e[1].dims).slice();C.splice(-1,1,l/f),x.push(...W(S)),x.push(...W(C)),x.push(...W(e[2].dims)),e.length===4&&x.push(...W(z.convertShape(e[3].dims)));let w=[c,i,o];return x.push(...W(w)),{name:`BlockwiseMatMulNBits32`,shaderCache:{hint:`${t.blockSize};${d};${f};${h};${m}`,inputDependencies:Array(e.length).fill(`rank`)},getRunData:()=>({outputs:[{dims:p,dataType:u}],dispatchGroup:{x:b},programUniforms:x}),getShaderSource:n=>{let r=S.length,i=q(`a`,e[0].dataType,r,d),a=q(`b`,12,C.length,f),o=q(`scales`,e[2].dataType,e[2].dims.length),s=[i,a,o],c=e.length===4?q(`zero_points`,12,e[3].dims.length):void 0;c&&s.push(c);let l=w.length,u=J(`output`,e[0].dataType,l),p=U(e[0].dataType),_=()=>{switch(d){case 1:return`
          let a_data0 = vec4<${p}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${p}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${p}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${p}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw Error(`${d}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${i.type.value}, ${v}>;
        var<workgroup> inter_results: array<array<${u.type.value}, ${h}>, ${m}>;
        ${n.declareVariables(...s,u)}
        ${n.mainStart([h,m,1])}
          let output_indices = ${u.offsetToIndices(`workgroup_index * ${m}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${y} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${v};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${v}; a_offset += 128)
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${i.getByIndices(`${i.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${i.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${y} + local_id.x;
            ${c?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            let zero_point_word = ${c.getByOffset(`zero_point_word_index`)} >> zero_point_bits_offset;
            let zero_point = ${p}((zero_point_word) & ${t.bits===2?`0x3u`:`0xFu`});`:`
            // The default zero point is ${2**(t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${p}(${(2**(t.bits-1)).toFixed(1)});`}
            let scale = ${o.getByOffset(`b_row * n_blocks_per_col + block`)};
            let b_data = ${a.getByIndices(`${a.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/d};
            for (var i: u32 = 0; i < ${f}; i++) {
              let b_value = ${f===1?`b_data`:`b_data[i]`};
              ${(()=>{let e=Math.floor(g/8),n=``;for(let r=0;r<e;r++){let e=r*t.bits*4,i=e+t.bits;n+=`
              ${_()}
              {${t.bits===2?`
                let half_word = b_value >> ${r*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${e}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${i}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${p}>(${Array.from({length:4},(e,t)=>`${p}(b_value_lower[${t}]), ${p}(b_value_upper[${t}])`).join(`, `)});
                let b_dequantized_values = (b_quantized_values - mat2x4<${p}>(${Array(8).fill(`zero_point`).join(`,`)})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(e,t)=>`${`dot(a_data${t}, b_dequantized_values[${t}])`}`).join(` + `)};
              }
              word_offset += ${8/d};`}return n})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${m}) {
            var output_value: ${u.type.value} = ${u.type.value}(0);
            for (var b = 0u; b < ${h}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${u.setByIndices(`${u.type.indices}(batch, row, col + local_idx)`,`output_value`)}
            }
          }
        }`}}},Ac=(e,t)=>{Dc(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor(`intel`)&&e.adapterInfo.isArchitecture(`gen-12lp`)?e.compute(kc(e.inputs,t)):e.compute(Oc(e.inputs,t))},jc=e=>V(e)}),Nc,Pc,Fc,Ic,Lc,Rc,zc,Bc,Vc,Hc=c(()=>{L(),B(),Y(),Nc=e=>{if(!e||e.length<1)throw Error(`Too few inputs`);if(e[0].dataType!==1&&e[0].dataType!==10)throw Error(`Input type must be float or float16.`);if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw Error(`The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].`)}},Pc=(e,t,n)=>{let r=``;for(let i=t-1;i>=0;--i)r+=`
            k = i32(${e.indicesGet(`indices`,i)}) - ${K(`uniforms.pads`,i,n)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${K(`uniforms.x_shape`,i,t)})) {
              break;
            }
            offset += k * i32(${K(`uniforms.x_strides`,i,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${r}
            value = x[offset];
          }
      `},Fc=(e,t,n)=>{let r=``;for(let i=t-1;i>=0;--i)r+=`
                k = i32(${e.indicesGet(`indices`,i)}) - ${K(`uniforms.pads`,i,n)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${K(`uniforms.x_shape`,i,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${K(`uniforms.x_shape`,i,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${K(`uniforms.x_strides`,i,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${r}
              value = x[offset];
          `},Ic=(e,t,n)=>{let r=``;for(let i=t-1;i>=0;--i)r+=`
                k = i32(${e.indicesGet(`indices`,i)}) - ${K(`uniforms.pads`,i,n)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${K(`uniforms.x_shape`,i,t)})) {
                  k = i32(${K(`uniforms.x_shape`,i,t)}) - 1;
                }
                offset += k * i32(${K(`uniforms.x_strides`,i,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${r}
              value = x[offset];
          `},Lc=(e,t,n)=>{let r=``;for(let i=t-1;i>=0;--i)r+=`
                k = i32(${e.indicesGet(`indices`,i)}) - ${K(`uniforms.pads`,i,n)};
                if (k < 0)  {
                  k += i32(${K(`uniforms.x_shape`,i,t)}]);
                }
                if (k >= i32(${K(`uniforms.x_shape`,i,t)})) {
                  k -= i32(${K(`uniforms.x_shape`,i,t)});
                }
                offset += k * i32(${K(`uniforms.x_strides`,i,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${r}
              value = x[offset];
          `},Rc=(e,t,n)=>{switch(n.mode){case 0:return Pc(e,t,n.pads.length);case 1:return Fc(e,t,n.pads.length);case 2:return Ic(e,t,n.pads.length);case 3:return Lc(e,t,n.pads.length);default:throw Error(`Invalid mode`)}},zc=(e,t)=>{let n=z.padShape(e[0].dims.slice(),t.pads),r=e[0].dims,i=[{type:12,data:z.size(n)},{type:6,data:t.pads}],a=e.length>=3&&e[2].data;return t.mode===0&&i.push({type:a?e[2].dataType:1,data:t.value}),i.push(...W(e[0].dims,n)),{name:`Pad`,shaderCache:{hint:`${t.mode}${a}`,inputDependencies:[`rank`]},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(z.size(n)/64)},programUniforms:i}),getShaderSource:i=>{let o=J(`output`,e[0].dataType,n.length),s=q(`x`,e[0].dataType,r.length),c=s.type.value,l=Rc(o,r.length,t),u=[{name:`output_size`,type:`u32`},{name:`pads`,type:`i32`,length:t.pads.length}];return t.mode===0&&u.push({name:`constant_value`,type:a?c:`f32`}),`
            ${i.registerUniforms(u).declareVariables(s,o)}
            ${i.mainStart()}
            ${i.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}

            let indices = ${o.offsetToIndices(`global_idx`)};

            var value = ${c}(0);
            ${l}
            output[global_idx] = value;
        }`}}},Bc=(e,t)=>{if(e.length>1){let n=e[1].getBigInt64Array(),r=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,i=e[0].dims.length,a=new Int32Array(2*i).fill(0);if(e.length>=4){let t=e[3].getBigInt64Array();for(let e=0;e<t.length;e++)a[Number(t[e])]=Number(n[e]),a[Number(t[e])+i]=Number(n[e+t.length])}else n.forEach((e,t)=>a[Number(t)]=Number(e));let o=[];return a.forEach(e=>o.push(e)),{mode:t.mode,value:r,pads:o}}else return t},Vc=(e,t)=>{Nc(e.inputs);let n=Bc(e.inputs,t);e.compute(zc(e.inputs,n),{inputs:[0]})}}),Uc,Wc,Gc,Kc,qc,Jc,Yc,Xc,Zc,Qc,$c,el,tl,nl,rl,il,al,ol,sl,cl=c(()=>{Me(),L(),B(),Y(),Uc=e=>{if(w.webgpu.validateInputContent&&(!e||e.length!==1))throw Error(`Pool ops requires 1 input.`)},Wc=(e,t,n)=>{let r=t.format===`NHWC`,i=e.dims.slice();r&&i.splice(1,0,i.pop());let a=Object.hasOwnProperty.call(t,`dilations`),o=t.kernelShape.slice(),s=t.strides.slice(),c=a?t.dilations.slice():[],l=t.pads.slice();Ht.adjustPoolAttributes(n,i,o,s,c,l);let u=Ht.computePoolOutputShape(n,i,s,c,o,l,t.autoPad),d=Object.assign({},t);a?Object.assign(d,{kernelShape:o,strides:s,pads:l,dilations:c,cacheKey:t.cacheKey}):Object.assign(d,{kernelShape:o,strides:s,pads:l,cacheKey:t.cacheKey});let f=u.slice();return f.push(f.splice(1,1)[0]),[d,r?f:u]},Gc=(e,t)=>{let n=t.format===`NHWC`,r=z.size(e),i=z.size(t.kernelShape),a=[{type:12,data:r},{type:12,data:i}],o=[{name:`outputSize`,type:`u32`},{name:`kernelSize`,type:`u32`}];if(t.kernelShape.length<=2){let e=t.kernelShape[t.kernelShape.length-1],n=t.strides[t.strides.length-1],r=t.pads[t.pads.length/2-1],i=t.pads[t.pads.length-1],s=!!(r+i);a.push({type:12,data:e},{type:12,data:n},{type:12,data:r},{type:12,data:i}),o.push({name:`kw`,type:`u32`},{name:`sw`,type:`u32`},{name:`pwStart`,type:`u32`},{name:`pwEnd`,type:`u32`});let c=!1;if(t.kernelShape.length===2){let e=t.kernelShape[t.kernelShape.length-2],n=t.strides[t.strides.length-2],r=t.pads[t.pads.length/2-2],i=t.pads[t.pads.length-2];c=!!(r+i),a.push({type:12,data:e},{type:12,data:n},{type:12,data:r},{type:12,data:i}),o.push({name:`kh`,type:`u32`},{name:`sh`,type:`u32`},{name:`phStart`,type:`u32`},{name:`phEnd`,type:`u32`})}return[a,o,!0,s,c]}else{if(n)throw Error(`Pooling with kernelShape.length > 2 is not supported for NHWC format.`);let e=z.computeStrides(t.kernelShape);return a.push({type:12,data:e},{type:12,data:t.pads},{type:12,data:t.strides}),o.push({name:`kernelStrides`,type:`u32`,length:e.length},{name:`pads`,type:`u32`,length:t.pads.length},{name:`strides`,type:`u32`,length:t.strides.length}),[a,o,!!t.pads.reduce((e,t)=>e+t),!1,!1]}},Kc=(e,t,n,r,i,a,o,s,c,l,u,d)=>{let f=i.format===`NHWC`,p=t.type.value,m=J(`output`,t.type.tensor,r);if(i.kernelShape.length<=2){let r=``,l=``,h=``,g=n-(f?2:1);if(r=u?`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${g}] = indices[${g}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${g}] < 0 || xIndices[${g}]
                      >= uniforms.x_shape[${g}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset(`xIndices`)}];
                  ${a}
                }`:`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${g}] = indices[${g}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset(`xIndices`)}];
                  ${a}
                }`,i.kernelShape.length===2){let e=n-(f?3:2);l=d?`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${e}] = indices[${e}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${e}] < 0 || xIndices[${e}] >= uniforms.x_shape[${e}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${e}] = indices[${e}] * uniforms.sh - uniforms.phStart + j;
                `,h=`
              }
            `}return`
            ${e.registerUniforms(c).declareVariables(t,m)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}

              let indices = ${m.offsetToIndices(`global_idx`)};
              var xIndices = ${m.offsetToIndices(`global_idx`)};

              var value = ${p}(${s});
              var pad = 0;
              ${l}
              ${r}
              ${h}
              ${o}

              output[global_idx] = value;
            }`}else{if(f)throw Error(`Pooling with kernelShape.length > 2 is not supported for NHWC format.`);let r=i.kernelShape.length,u=i.pads.length,d=``;return d=l?`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset(`xIndices`)}];
                ${a}
              }`:`
              }
              let x_val = x[${t.indicesToOffset(`xIndices`)}];
              ${a}
            `,`
            ${e.registerUniforms(c).declareVariables(t,m)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
              let indices = ${m.offsetToIndices(`global_idx`)};
              var xIndices = ${m.offsetToIndices(`global_idx`)};

              var offsets: array<u32, ${r}>;

              var value = ${p}(${s});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${r-1}u; j++) {
                  offsets[j] = offset / ${K(`uniforms.kernelStrides`,`j`,r)};
                  offset -= offsets[j] * ${K(`uniforms.kernelStrides`,`j`,r)};
                }
                offsets[${r-1}] = offset;

                isPad = false;
                for (var j = ${n-r}u; j < ${n}u; j++) {
                  xIndices[j] = indices[j] * ${K(`uniforms.strides`,`j - ${n-r}u`,r)}
                    + offsets[j - ${n-r}u] - ${K(`uniforms.pads`,`j - 2u`,u)};
                  ${d}
              }
              ${o}

              output[global_idx] = value;
            }`}},qc=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,Jc=e=>`${qc(e)};${e.countIncludePad}`,Yc=e=>`${qc(e)};${e.storageOrder};${e.dilations}`,Xc=e=>({format:e.format,autoPad:[`NOTSET`,`VALID`,`SAME_UPPER`,`SAME_LOWER`][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),Zc=(e,t,n,r)=>{let[i,a]=Wc(t,r,n),o=q(`x`,t.dataType,t.dims.length),s=o.type.value,c=``;i.countIncludePad?c+=`value /= ${s}(uniforms.kernelSize);`:c+=`value /= ${s}(i32(uniforms.kernelSize) - pad);`;let[l,u,d,f,p]=Gc(a,i);return l.push(...W(t.dims,a)),{name:e,shaderCache:{hint:`${r.cacheKey};${d};${f};${p}`,inputDependencies:[`rank`]},getRunData:()=>({outputs:[{dims:a,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(z.size(a)/64)},programUniforms:l}),getShaderSource:e=>Kc(e,o,t.dims.length,a.length,i,`value += x_val;`,c,0,u,d,f,p)}},Qc=e=>{let t=e.count_include_pad!==0,n=Xc(e);if(n.ceilMode!==0)throw Error(`using ceil() in shape computation is not yet supported for AveragePool`);let r={countIncludePad:t,...n,cacheKey:``};return{...r,cacheKey:Jc(r)}},$c=(e,t)=>{Uc(e.inputs),e.compute(Zc(`AveragePool`,e.inputs[0],!1,t))},el={autoPad:``,ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},tl=e=>{let t=e.format;return{format:t,...el,cacheKey:t}},nl=(e,t)=>{Uc(e.inputs),e.compute(Zc(`GlobalAveragePool`,e.inputs[0],!0,t))},rl=(e,t,n,r)=>{let[i,a]=Wc(t,r,n),o=q(`x`,t.dataType,t.dims.length),s=[`rank`],[c,l,u,d,f]=Gc(a,i);return c.push(...W(t.dims,a)),{name:e,shaderCache:{hint:`${r.cacheKey};${u};${d};${f}`,inputDependencies:s},getRunData:()=>({outputs:[{dims:a,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(z.size(a)/64)},programUniforms:c}),getShaderSource:e=>Kc(e,o,t.dims.length,a.length,i,`
      value = max(x_val, value);
    `,``,t.dataType===10?-65504:-1e5,l,u,d,f)}},il=(e,t)=>{Uc(e.inputs),e.compute(rl(`MaxPool`,e.inputs[0],!1,t))},al=e=>{let t=e.storage_order,n=e.dilations,r=Xc(e);if(t!==0)throw Error(`column major storage order is not yet supported for MaxPool`);if(r.ceilMode!==0)throw Error(`using ceil() in shape computation is not yet supported for MaxPool`);let i={storageOrder:t,dilations:n,...r,cacheKey:``};return{...i,cacheKey:Yc(i)}},ol=e=>{let t=e.format;return{format:t,...el,cacheKey:t}},sl=(e,t)=>{Uc(e.inputs),e.compute(rl(`GlobalMaxPool`,e.inputs[0],!0,t))}}),ll,ul,dl,fl,pl=c(()=>{L(),B(),H(),Y(),ll=(e,t)=>{if(e.length<2||e.length>3)throw Error(`DequantizeLinear requires 2 or 3 inputs.`);if(e.length===3&&e[1].dims===e[2].dims)throw Error(`x-scale and x-zero-point must have the same shape.`);if(e.length===3&&e[0].dataType!==e[2].dataType)throw Error(`x and x-zero-point must have the same data type.`);if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw Error(`scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.`);if(e.length>2){if(e[0].dataType!==e[2].dataType)throw Error(`x and x-zero-point must have the same data type.`);if(e[1].dims.length!==e[2].dims.length)throw Error(`scale and zero-point inputs must have the same rank.`);if(!e[1].dims.map((t,n)=>t===e[2].dims[n]).reduce((e,t)=>e&&t,!0))throw Error(`scale and zero-point inputs must have the same shape.`)}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw Error(`blockSize must be set only for block quantization.`);if(!e[1].dims.map((n,r)=>r===t.axis||n===e[0].dims[r]).reduce((e,t)=>e&&t,!0))throw Error(`For block qunatization, scale input shape to match the input shape except for the axis`);if(e[1].dims.length!==e[0].dims.length)throw Error(`For block qunatization the scale input rank must be the same as the x rank.`);let n=e[0].dims[t.axis],r=e[1].dims[t.axis];if(t.blockSize<Math.ceil(n/r)||t.blockSize>Math.ceil(n/(r-1)-1))throw Error(`blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].`)}},ul=(e,t)=>{let n=z.normalizeAxis(t.axis,e[0].dims.length),r=e[0].dataType,i=r===3,a=e[0].dims,o=e[1].dataType,s=z.size(a),c=r===3||r===2,l=c?[Math.ceil(z.size(e[0].dims)/4)]:e[0].dims,u=e[1].dims,d=e.length>2?e[2]:void 0,f=d?c?[Math.ceil(z.size(d.dims)/4)]:d.dims:void 0,p=u.length===0||u.length===1&&u[0]===1,m=p===!1&&u.length===1,h=G(s),g=p&&(!c||h===4),_=g?h:1,v=g&&!c?h:1,y=q(`input`,c?12:r,l.length,v),b=q(`scale`,o,u.length),x=d?q(`zero_point`,c?12:r,f.length):void 0,S=J(`output`,o,a.length,_),C=[y,b];x&&C.push(x);let w=[l,u];d&&w.push(f);let T=[{type:12,data:s/_},{type:12,data:n},{type:12,data:t.blockSize},...W(...w,a)];return{name:`DequantizeLinear`,shaderCache:{hint:t.cacheKey,inputDependencies:x?[`rank`,`rank`,`rank`]:[`rank`,`rank`]},getShaderSource:e=>`
      ${e.registerUniforms([{name:`output_size`,type:`u32`},{name:`axis`,type:`u32`},{name:`block_size`,type:`u32`}]).declareVariables(...C,S)}
      ${e.mainStart()}
          ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
          let output_indices = ${S.offsetToIndices(`global_idx`)};

          // Set input x
          ${c?`
            let input = ${y.getByOffset(`global_idx / 4`)};
            let x_vec = ${i?`unpack4xI8(input)`:`unpack4xU8(input)`};
            let x_value = ${_===1?`x_vec[global_idx % 4]`:`x_vec`};`:`let x_value = ${y.getByOffset(`global_idx`)};`};

          // Set scale input
          ${p?`let scale_value= ${b.getByOffset(`0`)}`:m?`
            let scale_index = ${S.indicesGet(`output_indices`,`uniforms.axis`)};
            let scale_value= ${b.getByOffset(`scale_index`)};`:`
            var scale_indices: ${b.type.indices} = output_indices;
            let index = ${b.indicesGet(`scale_indices`,`uniforms.axis`)} / uniforms.block_size;
            ${b.indicesSet(`scale_indices`,`uniforms.axis`,`index`)};
            let scale_value= ${b.getByIndices(`scale_indices`)};`};

          // Set zero-point input
          ${x?p?c?`
                let zero_point_input = ${x.getByOffset(`0`)};
                let zero_point_vec =  ${i?`unpack4xI8(zero_point_input)`:`unpack4xU8(zero_point_input)`};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${x.getByOffset(`0`)}`:m?c?`
                let zero_point_index = ${S.indicesGet(`output_indices`,`uniforms.axis`)};
                let zero_point_input = ${x.getByOffset(`zero_point_index / 4`)};
                let zero_point_vec =  ${i?`unpack4xI8(zero_point_input)`:`unpack4xU8(zero_point_input)`};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${S.indicesGet(`output_indices`,`uniforms.axis`)};
                let zero_point_value = ${x.getByOffset(`zero_point_index`)};`:c?`
                let zero_point_offset = ${b.indicesToOffset(`scale_indices`)};
                let zero_point_input = ${x.getByOffset(`zero_point_offset / 4`)};
                let zero_point_vec = ${i?`unpack4xI8(zero_point_input)`:`unpack4xU8(zero_point_input)`};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${x.getByIndices(`scale_indices`)};`:`let zero_point_value = ${c?i?`i32`:`u32`:y.type.value}(0);`};
      // Compute and write output
      ${S.setByOffset(`global_idx`,`${S.type.value}(x_value - zero_point_value) * scale_value`)};
      }`,getRunData:()=>({outputs:[{dims:a,dataType:o}],dispatchGroup:{x:Math.ceil(s/_/64),y:1,z:1},programUniforms:T})}},dl=(e,t)=>{ll(e.inputs,t),e.compute(ul(e.inputs,t))},fl=e=>V({axis:e.axis,blockSize:e.blockSize})}),ml,hl,gl,_l=c(()=>{Me(),L(),Y(),ml=(e,t,n)=>{if(e===t||e<t&&n<0||e>t&&n>0)throw Error(`Range these inputs' contents are invalid.`)},hl=(e,t,n,r)=>{let i=Math.abs(Math.ceil((t-e)/n)),a=[i],o=i,s=[{type:12,data:o},{type:r,data:e},{type:r,data:n},...W(a)];return{name:`Range`,shaderCache:{hint:`${r}`},getShaderSource:e=>{let t=J(`output`,r,a.length),n=t.type.value,i=[{name:`outputSize`,type:`u32`},{name:`start`,type:n},{name:`delta`,type:n}];return`
        ${e.registerUniforms(i).declareVariables(t)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
        output[global_idx] = uniforms.start + ${n}(global_idx) * uniforms.delta;
      }`},getRunData:()=>({outputs:[{dims:a,dataType:r}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:s})}},gl=e=>{let t=0,n=0,r=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],n=e.inputs[1].getInt32Array()[0],r=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],n=e.inputs[1].getFloat32Array()[0],r=e.inputs[2].getFloat32Array()[0]),w.webgpu.validateInputContent&&ml(t,n,r),e.compute(hl(t,n,r,e.inputs[0].dataType),{inputs:[]})}}),vl,yl,bl,xl,Sl=c(()=>{L(),B(),H(),Y(),vl=(e,t,n,r)=>{if(e!==`none`&&r!==`i32`&&r!==`u32`&&r!==`f32`)throw Error(`Input ${r} is not supported with reduction ${e}.`);let i=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,a=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case`none`:return`${t}=${n};`;case`add`:return r===`i32`||r===`u32`?`atomicAdd(&${t}, bitcast<${r}>(${n}));`:`
              ${i}bitcast<${r}>(oldValue) + (${n})${a}`;case`max`:return r===`i32`||r===`u32`?`atomicMax(&${t}, bitcast<${r}>(${n}));`:`
                ${i}max(bitcast<f32>(oldValue), (${n}))${a}`;case`min`:return r===`i32`||r===`u32`?`atomicMin(&${t}, bitcast<${r}>(${n}));`:`${i}min(bitcast<${r}>(oldValue), (${n}))${a}`;case`mul`:return`${i}(bitcast<${r}>(oldValue) * (${n}))${a}`;default:throw Error(`Reduction ${e} is not supported.`)}},yl=(e,t)=>{let n=e[0].dims,r=e[1].dims,i=n,a=Math.ceil(z.sizeToDimension(r,r.length-1)/1),o=r[r.length-1],s=z.sizeFromDimension(n,o),c=[{type:12,data:a},{type:12,data:o},{type:12,data:s},...W(e[1].dims,e[2].dims,i)];return{name:`ScatterND`,shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:[`rank`,`rank`]},getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:c}),getShaderSource:n=>{let r=q(`indices`,e[1].dataType,e[1].dims.length),a=q(`updates`,e[2].dataType,e[2].dims.length,1),o=t.reduction!==`none`&&t.reduction!==``?An(`output`,e[0].dataType,i.length):J(`output`,e[0].dataType,i.length,1);return`
      ${n.registerUniform(`output_size`,`u32`).registerUniform(`last_index_dimension`,`u32`).registerUniform(`num_updates_elements`,`u32`).declareVariables(r,a,o)}
      ${n.mainStart()}
        ${n.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${vl(t.reduction,`output[data_offset + i]`,`value`,o.type.value)}
  }

      }`}}},bl=e=>V({reduction:e.reduction}),xl=(e,t)=>{e.compute(yl(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),Cl,wl,Tl,El,Dl,Ol,kl,Al,jl,Ml,Nl,Pl,Fl,Il,Ll,Rl,zl,Bl,Vl,Hl,Ul=c(()=>{L(),B(),H(),Y(),Cl=(e,t)=>{if(e.every(e=>e>0||(()=>{throw Error(`Resize requires scales input values to be positive`)})),e.length>0){if(t.mode===`linear`){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode===`cubic`&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw Error(`Resize requires scales input size to be 2 or 4 for cubic mode`)}},wl=(e,t,n)=>{t.every(e=>e>=0&&e<n||(()=>{throw Error(`Resize requires axes input values to be positive and less than rank`)}));let r=Array(n).fill(1);return t.forEach((t,n)=>r[t]=e[n]),r},Tl=(e,t,n,r,i,a)=>{let[o,s,c]=n>10?[1,2,3]:[-1,e.length>1?1:-1,-1],l=e[0].dims.length;if(o>0&&e.length>o&&e[o].dims.length>0)e[o].getFloat32Array().forEach(e=>a.push(e));else if(t.coordinateTransformMode===`tf_crop_and_resize`)throw Error(`Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize`);if(s>0&&e.length>s&&e[s].dims.length===1&&e[s].dims[0]>0){if(e[s].getFloat32Array().forEach(e=>r.push(e)),r.length!==0&&r.length!==l&&n>=18&&r.length!==t.axes.length)throw Error(`Resize requires scales input size to be same as input rank or axes size for opset 18 and up`);Cl(r,t),t.axes.length>0&&wl(r,t.axes,l).forEach((e,t)=>r[t]=e)}if(c>0&&e.length>c&&e[c].dims.length===1&&e[c].dims[0]>0&&(e[c].getBigInt64Array().forEach(e=>i.push(Number(e))),i.length!==0&&i.length!==l&&n>=18&&i.length!==t.axes.length))throw Error(`Resize requires sizes input size to be same as input rank or axes size for opset 18 and up`);if(t.axes.length>0){if(r.length!==0&&r.length!==t.axes.length)throw Error(`Resize requires "scales" input size to be of axes rank when axes attributes is specified`);if(i.length!==0&&i.length!==t.axes.length)throw Error(`Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified`)}if(typeof r<`u`&&typeof i<`u`&&r.length>0&&i.length>l)throw Error(`Resize requires only of scales or sizes to be specified`)},El=(e,t,n,r)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${r}(big / (${n}));
  let fract = ${r}(big % (${n})) / ${r}(${n});
  return whole + fract;
`,Dl=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case`asymmetric`:return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${El(`xResized`,`lengthOriginal`,`lengthResized`,t)}
          }
        `;case`pytorch_half_pixel`:return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case`tf_half_pixel_for_nn`:return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case`align_corners`:return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${El(`xResized`,`lengthOriginal - 1`,`lengthResized - 1`,t)}
                  }`;case`tf_crop_and_resize`:return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case`half_pixel_symmetric`:return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case`half_pixel`:return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw Error(`Coordinate transform mode ${e} is not supported`)}})()+`}`,Ol=(e,t,n)=>`fn getNearestPixelFromOriginal(xOriginal: ${n}, isDownSample: bool) -> ${n} {`+(()=>{switch(e){case`round_prefer_ceil`:return`if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }`;case`floor`:return`return floor(xOriginal);`;case`ceil`:return`return ceil(xOriginal);`;case`round_prefer_floor`:return`if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }`;default:if(t<11)return`if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }`;throw Error(`Nearest mode ${e} is not supported`)}})()+`}`,kl=(e,t,n)=>{let r=Array(n).fill(0).concat(Array(n).fill(1)),i=e.length===0?r:e.slice();return t.length>0?(t.forEach((e,a)=>{r[e]=i[a],r[a+n]=i[t.length+a]}),r):i},Al=(e,t,n,r)=>{let i=[];if(n.length>0)if(r.length>0){if(e.forEach(e=>i.push(e)),Math.max(...r)>e.length)throw Error(`axes is out of bound`);r.forEach((e,t)=>i[e]=n[t])}else n.forEach(e=>i.push(e));else{if(t.length===0)throw Error(`Resize requires either scales or sizes.`);i=e.map((e,n)=>Math.round(e*t[n]))}return i},jl=(e,t,n)=>{let r=(()=>{switch(n.keepAspectRatioPolicy){case`not_larger`:return n.axes.length>0?Math.min(...n.axes.map(e=>t[e]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case`not_smaller`:return n.axes.length>0?Math.max(...n.axes.map(e=>t[e]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw Error(`Keep aspect ratio policy ${n.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let i=e.slice();return n.axes.length>0?(n.axes.forEach(e=>t[e]=r),n.axes.forEach(n=>i[n]=Math.round(e[n]*t[n]))):(t.fill(r,0,t.length),i.forEach((e,n)=>i[n]=Math.round(e*t[n]))),i},Ml=(e,t,n,r,i)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${n.length}> {
      var original_indices: array<${e.type.value}, ${n.length}>;
      for (var i:u32 = 0; i < ${n.length}; i++) {
        var output_index = ${e.indicesGet(`output_indices`,`i`)};
        var scale = ${K(`uniforms.scales`,`i`,r)};
        var roi_low = ${K(`uniforms.roi`,`i`,i)};
        var roi_hi = ${K(`uniforms.roi`,`i + ${t.length}`,i)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${K(`uniforms.input_shape`,`i`,t.length)};
          var output_shape_i = ${K(`uniforms.output_shape`,`i`,n.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,Nl=(e,t,n,r,i,a,o)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${t.indicesGet(`output_indices`,`i`)};
        var input_index: u32;
        var scale = ${K(`uniforms.scales`,`i`,i)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${K(`uniforms.roi`,`i`,a)};
          var roi_hi = ${K(`uniforms.roi`,`i + ${n.length}`,a)};
          var input_shape_i = ${K(`uniforms.input_shape`,`i`,n.length)};
          var output_shape_i = ${K(`uniforms.output_shape`,`i`,r.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${o} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet(`input_indices`,`i`,`input_index`)}
      }
      return input_indices;
    }`,Pl=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet(`input_indices`,`i`)};
        if (input_index < 0 || input_index >= ${K(`uniforms.input_shape`,`i`,t.length)}) {
          return false;
        }
      }
      return true;
    }`,Fl=(e,t,n,r)=>e.rank>r?`
    ${e.indicesSet(`input_indices`,t,`channel`)};
    ${e.indicesSet(`input_indices`,n,`batch`)};
`:``,Il=(e,t,n,r,i)=>{let[a,o,s,c]=n.length===2?[-1,0,1,-1]:[0,2,3,1],l=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${l} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet(`input_indices`,o,`max(0, min(row, ${n[o]} - 1))`)};
      ${e.indicesSet(`input_indices`,s,`max(0, min(col, ${n[s]} - 1))`)};
      ${Fl(e,c,a,2)}
      return ${e.getByIndices(`input_indices`)};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${l} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${l} = originalIndices[${o}];
      var col:${l} = originalIndices[${s}];
      ${r?`if (row < 0 || row > (${n[o]} - 1) || col < 0 || col > (${n[s]} - 1)) {
        return ${i};
      }`:``};
      row = max(0, min(row, ${n[o]} - 1));
      col = max(0, min(col, ${n[s]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${n.length>2?`u32(originalIndices[${c}])`:`0`};
      var batch: u32 =  ${n.length>2?`u32(originalIndices[${a}])`:`0`};
      var x11: ${l} = getInputValue(batch, channel, row1, col1);
      var x12: ${l} = getInputValue(batch, channel, row1, col2);
      var x21: ${l} = getInputValue(batch, channel, row2, col1);
      var x22: ${l} = getInputValue(batch, channel, row2, col2);
      var dx1: ${l} = abs(row - ${l}(row1));
      var dx2: ${l} = abs(${l}(row2) - row);
      var dy1: ${l} = abs(col - ${l}(col1));
      var dy2: ${l} = abs(${l}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},Ll=(e,t,n,r,i,a,o,s,c,l)=>{let[u,d]=n.length===2?[0,1]:[2,3],f=e.type.value,p=o=>{let d=o===u?`row`:`col`;return`
      fn ${d}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${f} {
        var output_index = ${t.indicesGet(`output_indices`,o)};
        var originalIdx: ${f} = getOriginalCoordinateFromResizedCoordinate(output_index, ${i[o]},
        ${r[o]}, ${n[o]}, ${a[o]}, ${a[o]} + ${n.length});
        var fractOriginalIdx: ${f} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${s} && (originalIdx < 0 || originalIdx > (${n[o]} - 1))) {
          return ${c};
        }
        var data: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${d}: ${f} = originalIdx + ${f}(i);
          if (${d} < 0 || ${d} >= ${n[o]}) {
            ${l?`coefs[i + 1] = 0.0;
                        continue;`:s?`return ${c};`:`${d} = max(0, min(${d}, ${n[o]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet(`input_indices_copy`,o,`u32(${d})`)};
          data[i + 1] = ${o===u?e.getByIndices(`input_indices_copy`):`rowCubicInterpolation(input_indices_copy, output_indices)`};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${p(u)};
    ${p(d)};
  fn getCubicInterpolationCoefs(s: ${f}) -> array<${f}, 4> {
    var absS = abs(s);
    var coeffs: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${f} = 1.0 - absS;
    var twoMinusAbsS: ${f} = 2.0 - absS;
    var onePlusAbsS: ${f} = 1.0 + absS;
    coeffs[0] = ((${o} * onePlusAbsS - 5 * ${o}) * onePlusAbsS + 8 * ${o}) * onePlusAbsS - 4 * ${o};
    coeffs[1] = ((${o} + 2) * absS - (${o} + 3)) * absS * absS + 1;
    coeffs[2] = ((${o} + 2) * oneMinusAbsS - (${o} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${o} * twoMinusAbsS - 5 * ${o}) * twoMinusAbsS + 8 * ${o}) * twoMinusAbsS - 4 * ${o};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${f}, 4>, coefs: array<${f}, 4>) -> ${f} {
    var coefsSum: ${f} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${f} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},Rl=(e,t,n,r,i)=>{let[a,o,s,c,l]=n.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],u=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${u} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet(`input_indices`,o,`max(0, min(depth, ${n[o]} - 1))`)};
      ${e.indicesSet(`input_indices`,s,`max(0, min(height, ${n[s]} - 1))`)};
      ${e.indicesSet(`input_indices`,c,`max(0, min(width, ${n[c]} - 1))`)};
      ${Fl(e,l,a,3)}
      return ${e.getByIndices(`input_indices`)};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${u} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${u} = originalIndices[${o}];
      var height:${u} = originalIndices[${s}];
      var width:${u} = originalIndices[${c}];
      ${r?`if (depth < 0 || depth > (${n[o]} - 1) || height < 0 || height > (${n[s]} - 1) || width < 0 || (width > ${n[c]} - 1)) {
      return ${i};
        }`:``};

    depth = max(0, min(depth, ${n[o]} - 1));
      height = max(0, min(height, ${n[s]} - 1));
      width = max(0, min(width, ${n[c]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${n.length>3?`u32(originalIndices[${l}])`:`0`};
      var batch: u32 =  ${n.length>3?`u32(originalIndices[${a}])`:`0`};

      var x111: ${u} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${u} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${u} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${u} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${u} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${u} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${u} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${u} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${u} = abs(depth - ${u}(depth1));
      var dx2: ${u} = abs(${u}(depth2) - depth);
      var dy1: ${u} = abs(height - ${u}(height1));
      var dy2: ${u} = abs(${u}(height2) - height);
      var dz1: ${u} = abs(width - ${u}(width1));
      var dz2: ${u} = abs(${u}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},zl=(e,t,n,r,i,a)=>{let o=e.dims,s=kl(a,t.axes,o.length),c=Al(o,r,i,t.axes),l=r.slice();r.length===0&&(l=o.map((e,t)=>e===0?1:c[t]/e),t.keepAspectRatioPolicy!==`stretch`&&(c=jl(o,l,t)));let u=J(`output`,e.dataType,c.length),d=q(`input`,e.dataType,o.length),f=z.size(c),p=o.length===c.length&&o.every((e,t)=>e===c[t]),m=t.coordinateTransformMode===`tf_crop_and_resize`,h=t.extrapolationValue,g=d.type.value;return{name:`Resize`,shaderCache:{hint:`${t.cacheKey}|${n}|${l.length>0?t.mode===`cubic`?l:l.length:``}|${i.length>0?i:``}|${s.length>0?s:``}|${p}|${t.mode===`nearest`?o.length:o}`,inputDependencies:[`rank`]},getShaderSource:e=>`
      ${p?``:`
      ${Dl(t.coordinateTransformMode,g)};
      ${(()=>{switch(t.mode){case`nearest`:return`
              ${Pl(d,o)};
              ${Ol(t.nearestMode,n,g)};
              ${Nl(d,u,o,c,l.length,s.length,m)};
              `;case`linear`:return`
              ${Ml(u,o,c,l.length,s.length)};
              ${(()=>{if(o.length===2||o.length===4)return`${Il(d,u,o,m,h)}`;if(o.length===3||o.length===5)return`${Rl(d,u,o,m,h)}`;throw Error(`Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.`)})()};
            `;case`cubic`:return`
            ${(()=>{if(o.length===2||o.length===4)return`${Ll(d,u,o,c,l,s,t.cubicCoeffA,m,t.extrapolationValue,t.excludeOutside)}`;throw Error(`Cubic mode only supports input dims 2 and 4 are supported in linear mode.`)})()};
            `;default:throw Error(`Invalid resize mode`)}})()};
      `}
      ${e.registerUniform(`output_size`,`u32`).registerUniform(`scales`,`f32`,l.length).registerUniform(`roi`,`f32`,s.length).declareVariables(d,u)}
      ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
        ${p?`output[global_idx] = input[global_idx];`:`
        let output_indices = ${u.offsetToIndices(`global_idx`)};
        var input_indices: ${d.type.indices};
        ${(()=>{switch(t.mode){case`nearest`:return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${d.getByIndices(`input_indices`)};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case`linear`:return`output[global_idx] = ${o.length===2||o.length===4?`bilinearInterpolation`:`trilinearInterpolation`}(output_indices);`;case`cubic`:return`output[global_idx] = bicubicInterpolation(output_indices);`;default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`,getRunData:()=>({outputs:[{dims:c,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},{type:1,data:l},{type:1,data:s},...W(o,c)]})}},Bl=e=>{let t=e.customDataBuffer;return new Uint32Array(t.buffer,t.byteOffset,1)[0]},Vl=(e,t)=>{let n=[],r=[],i=[],a=Bl(e);if(t.antialias!==0)throw Error(`Only default value (0) for Antialias attribute is supported`);Tl(e.inputs,t,a,n,r,i),e.compute(zl(e.inputs[0],t,a,n,r,i),{inputs:[0]})},Hl=e=>{let t=e.antialias,n=e.axes,r=e.coordinateTransformMode,i=e.cubicCoeffA,a=e.excludeOutside!==0,o=e.extrapolationValue,s=e.keepAspectRatioPolicy,c=e.mode,l=e.nearestMode===``?`simple`:e.nearestMode;return V({antialias:t,axes:n,coordinateTransformMode:r,cubicCoeffA:i,excludeOutside:a,extrapolationValue:o,keepAspectRatioPolicy:s,mode:c,nearestMode:l})}}),Wl,Gl,Kl,ql=c(()=>{L(),B(),Y(),Wl=e=>{if(!e||e.length<3)throw Error(`layerNorm requires at least 3 inputs.`);let t=e[0],n=e[1],r=e[2];if(t.dataType!==n.dataType||t.dataType!==r.dataType)throw Error(`All inputs must have the same data type`);if(t.dims.length!==3&&t.dims.length!==2)throw Error(`Input must be 2D or 3D`);if(n.dims.length!==3&&n.dims.length!==2)throw Error(`Skip must be 2D or 3D`);let i=t.dims[t.dims.length-1],a=t.dims[t.dims.length-2];if(n.dims[n.dims.length-1]!==i)throw Error(`Skip must have the same hidden size as input`);if(n.dims[n.dims.length-2]!==a)throw Error(`Skip must have the same sequence length as input`);if(r.dims.length!==1)throw Error(`Gamma must be 1D`);if(r.dims[r.dims.length-1]!==i)throw Error(`Gamma must have the same hidden size as input`);if(e.length>3){let t=e[3];if(t.dims.length!==1)throw Error(`Beta must be 1D`);if(t.dims[t.dims.length-1]!==i)throw Error(`Beta must have the same hidden size as input`)}if(e.length>4){let t=e[4];if(t.dims.length!==1)throw Error(`Bias must be 1D`);if(t.dims[t.dims.length-1]!==i)throw Error(`Bias must have the same hidden size as input`)}},Gl=(e,t,n,r)=>{let i=t.simplified,a=e[0].dims,o=z.size(a),s=a,c=o,l=a.slice(-1)[0],u=r?a.slice(0,-1).concat(1):[],d=!i&&e.length>3,f=e.length>4,p=r&&n>1,m=r&&n>2,h=n>3,g=G(l),_=[{type:12,data:c},{type:12,data:g},{type:12,data:l},{type:1,data:t.epsilon}],v=t=>{let n=[{name:`output_size`,type:`u32`},{name:`components`,type:`u32`},{name:`hidden_size`,type:`u32`},{name:`epsilon`,type:`f32`}],r=[q(`x`,e[0].dataType,e[0].dims,g),q(`skip`,e[1].dataType,e[1].dims,g),q(`gamma`,e[2].dataType,e[2].dims,g)];d&&r.push(q(`beta`,e[3].dataType,e[3].dims,g)),f&&r.push(q(`bias`,e[4].dataType,e[4].dims,g)),r.push(J(`output`,e[0].dataType,s,g)),p&&r.push(J(`mean_output`,1,u)),m&&r.push(J(`inv_std_output`,1,u)),h&&r.push(J(`input_skip_bias_sum`,e[0].dataType,s,g));let a=U(e[0].dataType),o=U(1,g);return`

      ${t.registerUniforms(n).declareVariables(...r)}
      var<workgroup> sum_shared : array<${o}, 64>;
      var<workgroup> sum_squared_shared : array<${o}, 64>;

      ${t.mainStart([64,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / 64;

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / 64;
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == 63) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${f?`bias[offset1d + i]`:a+`(0.0)`};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${h?`input_skip_bias_sum[offset + i] = value;`:``}
          output[offset + i] = value;
          let f32_value = ${Dn(a,g,`value`)};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = 64;
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${On(`sum`,g)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${On(`square_sum`,g)} / f32(uniforms.hidden_size) ${i?``:`- mean * mean`} + uniforms.epsilon);
        ${p?`mean_output[global_idx] = mean;`:``}
        ${m?`inv_std_output[global_idx] = inv_std_dev;`:``}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${i?``:`- ${a}(mean)`}) *
            ${a}(inv_std_dev) * gamma[offset1d + i]
            ${d?`+ beta[offset1d + i]`:``};
        }
      }`},y=[{dims:s,dataType:e[0].dataType}];return n>1&&y.push({dims:u,dataType:1}),n>2&&y.push({dims:u,dataType:1}),n>3&&y.push({dims:a,dataType:e[0].dataType}),{name:`SkipLayerNormalization`,shaderCache:{hint:`${g};${p};${m};${h}`,inputDependencies:e.map((e,t)=>`type`)},getShaderSource:v,getRunData:()=>({outputs:y,dispatchGroup:{x:Math.ceil(c/l)},programUniforms:_})}},Kl=(e,t)=>{Wl(e.inputs);let n=[0];e.outputCount>1&&n.push(-3),e.outputCount>2&&n.push(-3),e.outputCount>3&&n.push(3),e.compute(Gl(e.inputs,t,e.outputCount,!1),{outputs:n})}}),Jl,Yl,Xl,Zl,Ql,$l,eu,tu,nu=c(()=>{L(),B(),H(),Y(),Jl=(e,t)=>{if(!e||e.length<1)throw Error(`too few inputs`);if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw Error(`axes, starts and ends must have the same length`)}else if(t.starts.length!==t.ends.length)throw Error(`starts and ends must have the same length`);e.slice(1).forEach((t,n)=>{if(e[n+1].dataType!==6&&e[n+1].dataType!==7)throw Error(`Input ${n} must be an array of int32 or int64`)})},Yl=(e,t)=>{let n=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(e=>n.push(Number(e)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(e=>n.push(Number(e)));else throw Error(`Input ${t} must be an array of int32 or int64`);return n},Xl=(e,t)=>{if(e.length>1){let t=Yl(e,1),n=Yl(e,2),r=Yl(e,3);return r.length===0&&(r=[...Array(e[0].dims.length).keys()]),V({starts:t,ends:n,axes:r})}else return t},Zl=(e,t,n,r,i)=>{let a=e;return e<0&&(a+=n[r[t]]),i[t]<0?Math.max(0,Math.min(a,n[r[t]]-1)):Math.max(0,Math.min(a,n[r[t]]))},Ql=(e,t,n)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${n.length-1}; i >= 0; i--) {
            let input_shape_i = ${K(`uniforms.input_shape`,`i`,n.length)};
            let steps_i = ${K(`uniforms.steps`,`i`,n.length)};
            let signs_i = ${K(`uniforms.signs`,`i`,n.length)};
            let starts_i = ${K(`uniforms.starts`,`i`,n.length)};
            var output_index = ${t.indicesGet(`output_indices`,`i`)};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet(`input_indices`,`i`,`input_index`)};
          }
          return input_indices;
      }`,$l=(e,t)=>{let n=e[0].dims,r=z.size(n),i=t.axes.length>0?z.normalizeAxes(t.axes,n.length):[...Array(n.length).keys()],a=Yl(e,4);a.forEach(e=>e!==0||(()=>{throw Error(`step cannot be 0`)})),a.length===0&&(a=Array(i.length).fill(1));let o=t.starts.map((e,t)=>Zl(e,t,n,i,a)),s=t.ends.map((e,t)=>Zl(e,t,n,i,a));if(i.length!==o.length||i.length!==s.length)throw Error(`start, ends and axes should have the same number of elements`);if(i.length!==n.length)for(let e=0;e<n.length;++e)i.includes(e)||(o.splice(e,0,0),s.splice(e,0,n[e]),a.splice(e,0,1));let c=a.map(e=>Math.sign(e));a.forEach((e,t,n)=>{if(e<0){let r=(s[t]-o[t])/e,i=o[t],c=i+r*a[t];o[t]=c,s[t]=i,n[t]=-e}});let l=n.slice(0);i.forEach((e,t)=>{l[e]=Math.ceil((s[e]-o[e])/a[e])});let u={dims:l,dataType:e[0].dataType},d=J(`output`,e[0].dataType,l.length),f=q(`input`,e[0].dataType,e[0].dims.length),p=z.size(l),m=[{name:`outputSize`,type:`u32`},{name:`starts`,type:`u32`,length:o.length},{name:`signs`,type:`i32`,length:c.length},{name:`steps`,type:`u32`,length:a.length}],h=[{type:12,data:p},{type:12,data:o},{type:6,data:c},{type:12,data:a},...W(e[0].dims,l)];return{name:`Slice`,shaderCache:{hint:`${c.length}_${o.length}_${a.length}`,inputDependencies:[`rank`]},getShaderSource:e=>`
      ${e.registerUniforms(m).declareVariables(f,d)}
        ${Ql(f,d,n)}
        ${e.mainStart()}
          ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.outputSize`)}
          let output_indices = ${d.offsetToIndices(`global_idx`)};
          let input_indices = calculateInputIndices(output_indices);
          ${d.setByOffset(`global_idx`,f.getByIndices(`input_indices`))}
      }`,getRunData:()=>({outputs:[u],dispatchGroup:{x:Math.ceil(r/64)},programUniforms:h})}},eu=(e,t)=>{Jl(e.inputs,t);let n=Xl(e.inputs,t);e.compute($l(e.inputs,n),{inputs:[0]})},tu=e=>{let t=e.starts,n=e.ends,r=e.axes;return V({starts:t,ends:n,axes:r})}}),ru,iu,au,ou,su=c(()=>{L(),B(),H(),Un(),Y(),ru=e=>{if(!e||e.length!==1)throw Error(`Softmax op requires 1 input.`)},iu=(e,t)=>{let n=e.inputs[0],r=n.dims,i=z.size(r),a=r.length,o=z.normalizeAxis(t.axis,a),s=o<r.length-1,c,l=[];s?(l=Array.from({length:a},(e,t)=>t),l[o]=a-1,l[a-1]=o,c=e.compute(Bn(n,l),{inputs:[n],outputs:[-1]})[0]):c=n;let u=c.dims,d=u[a-1],f=i/d,p=G(d),m=d/p,h=64;f===1&&(h=256);let g=(e,t)=>t===4?`max(max(${e}.x, ${e}.y), max(${e}.z, ${e}.w))`:t===2?`max(${e}.x, ${e}.y)`:t===3?`max(max(${e}.x, ${e}.y), ${e}.z)`:e,_=q(`x`,c.dataType,c.dims,p),v=J(`result`,c.dataType,c.dims,p),y=_.type.value,b=U(c.dataType)===`f32`?`var threadMax = ${y}(-3.4028234663852886e+38f);`:`var threadMax = ${y}(-65504.0h);`,x=e.compute({name:`Softmax`,shaderCache:{hint:`${p};${h}`,inputDependencies:[`type`]},getRunData:()=>({outputs:[{dims:u,dataType:c.dataType}],dispatchGroup:{x:f},programUniforms:[{type:6,data:m}]}),getShaderSource:e=>`
      var<workgroup> rowMaxShared : ${y};
      var<workgroup> rowSumShared : ${y};
      var<workgroup> threadShared : array<${y}, ${h}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${y} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${y}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${e.registerUniform(`packedCols`,`i32`).declareVariables(_,v)}
      ${e.mainStart(h)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${h};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${b}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${y}(${g(`threadShared[0]`,p)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${y}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${y}(${On(`threadShared[0]`,p)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${y}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`},{inputs:[c],outputs:[s?-1:0]})[0];s&&e.compute(Bn(x,l),{inputs:[x]})},au=(e,t)=>{ru(e.inputs),iu(e,t)},ou=e=>V({axis:e.axis})}),cu,lu,uu,du,fu,pu=c(()=>{L(),B(),Y(),cu=e=>Array.from(e.getBigInt64Array(),Number),lu=e=>{if(!e||e.length!==2)throw Error(`Tile requires 2 inputs.`);if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw Error(`Tile only support float, float16, int32, and uint32 data types`);if(e[1].dataType!==7)throw Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw Error("Tile `repeats` input should be 1-D");if(cu(e[1]).length!==e[0].dims.length)throw Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},uu=(e,t)=>{let n=[];for(let r=0;r<e.length;++r)n.push(e[r]*t[r]);return n},du=(e,t)=>{let n=e[0].dims,r=t==null?cu(e[1]):t,i=uu(n,r),a=z.size(i),o=e[0].dataType,s=q(`input`,o,n.length),c=J(`output`,o,i.length);return{name:`Tile`,shaderCache:{hint:`${r}`,inputDependencies:[`rank`]},getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},...W(e[0].dims,i)]}),getShaderSource:e=>`
      const inputShape = ${s.indices(...n)};
      ${e.registerUniform(`output_size`,`u32`).declareVariables(s,c)}
      ${e.mainStart()}
      ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.output_size`)}
      let output_indices = ${c.offsetToIndices(`global_idx`)};
      var input_indices: ${s.type.indices};
      for (var i = 0; i < ${n.length}; i++) {
        let input_dim_i = ${s.indicesGet(`uniforms.input_shape`,`i`)};
        let input_dim_value = ${c.indicesGet(`output_indices`,`i`)}  % input_dim_i;

        ${s.indicesSet(`input_indices`,`i`,`input_dim_value`)}
      }
      ${c.setByOffset(`global_idx`,s.getByIndices(`input_indices`))}
    }`}},fu=e=>{lu(e.inputs),e.compute(du(e.inputs),{inputs:[0]})}}),mu,hu,gu,_u=c(()=>{L(),B(),Y(),mu=(e,t,n,r,i)=>{let a=J(`output_data`,i,n.length,4),o=q(`a_data`,t[1].dataType,t[1].dims.length,4),s=q(`b_data`,t[2].dataType,t[2].dims.length,4),c=q(`c_data`,t[0].dataType,t[0].dims.length,4),l,u=(e,t,n)=>`select(${t}, ${e}, ${n})`;if(!r)l=a.setByOffset(`global_idx`,u(o.getByOffset(`global_idx`),s.getByOffset(`global_idx`),c.getByOffset(`global_idx`)));else{let e=(e,t,n=``)=>{let r=`a_data[index_a${t}][component_a${t}]`,i=`b_data[index_b${t}][component_b${t}]`,l=`bool(c_data[index_c${t}] & (0xffu << (component_c${t} * 8)))`;return`
            let output_indices${t} = ${a.offsetToIndices(`global_idx * 4u + ${t}u`)};
            let offset_a${t} = ${o.broadcastedIndicesToOffset(`output_indices${t}`,a)};
            let offset_b${t} = ${s.broadcastedIndicesToOffset(`output_indices${t}`,a)};
            let offset_c${t} = ${c.broadcastedIndicesToOffset(`output_indices${t}`,a)};
            let index_a${t} = offset_a${t} / 4u;
            let index_b${t} = offset_b${t} / 4u;
            let index_c${t} = offset_c${t} / 4u;
            let component_a${t} = offset_a${t} % 4u;
            let component_b${t} = offset_b${t} % 4u;
            let component_c${t} = offset_c${t} % 4u;
            ${e}[${t}] = ${n}(${u(r,i,l)});
          `};l=i===9?`
            var data = vec4<u32>(0);
            ${e(`data`,0,`u32`)}
            ${e(`data`,1,`u32`)}
            ${e(`data`,2,`u32`)}
            ${e(`data`,3,`u32`)}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:`
            ${e(`output_data[global_idx]`,0)}
            ${e(`output_data[global_idx]`,1)}
            ${e(`output_data[global_idx]`,2)}
            ${e(`output_data[global_idx]`,3)}
          `}return`
        ${e.registerUniform(`vec_size`,`u32`).declareVariables(c,o,s,a)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes(`uniforms.vec_size`)}
        ${l}
      }`},hu=e=>{let t=e[1].dims,n=e[2].dims,r=e[0].dims,i=e[1].dataType,a=!(z.areEqual(t,n)&&z.areEqual(n,r)),o=t,s=z.size(t);if(a){let e=Vt.calcShape(Vt.calcShape(t,n,!1),r,!1);if(!e)throw Error(`Can't perform where op on the given tensors`);o=e,s=z.size(o)}let c=Math.ceil(s/4);return{name:`Where`,shaderCache:{inputDependencies:[`rank`,`rank`,`rank`]},getShaderSource:t=>mu(t,e,o,a,i),getRunData:()=>({outputs:[{dims:o,dataType:i}],dispatchGroup:{x:Math.ceil(s/64/4)},programUniforms:[{type:12,data:c},...W(r,t,n,o)]})}},gu=e=>{e.compute(hu(e.inputs))}}),vu,yu=c(()=>{Br(),Yr(),ei(),ii(),$i(),pa(),ba(),mo(),Eo(),Ao(),Io(),Jo(),es(),rs(),cs(),fs(),_s(),Ss(),Ds(),Hs(),mc(),yc(),Cc(),Ec(),Mc(),Xs(),Hc(),cl(),pl(),_l(),Sl(),Fr(),Ul(),cc(),ql(),nu(),su(),ic(),pu(),Un(),Yi(),_u(),vu=new Map([[`Abs`,[oi]],[`Acos`,[si]],[`Acosh`,[ci]],[`Add`,[ra]],[`ArgMax`,[Rr,zr]],[`ArgMin`,[Lr,zr]],[`Asin`,[li]],[`Asinh`,[ui]],[`Atan`,[di]],[`Atanh`,[fi]],[`Attention`,[Jr]],[`AveragePool`,[$c,Qc]],[`BatchNormalization`,[$r]],[`BiasAdd`,[ri]],[`BiasSplitGelu`,[Qi]],[`Cast`,[mi,pi]],[`Ceil`,[_i]],[`Clip`,[gi]],[`Concat`,[va,ya]],[`Conv`,[po,co]],[`ConvTranspose`,[To,xo]],[`Cos`,[vi]],[`Cosh`,[yi]],[`CumSum`,[Oo,ko]],[`DepthToSpace`,[Po,Fo]],[`DequantizeLinear`,[dl,fl]],[`Div`,[ia]],[`Einsum`,[Ko,qo]],[`Elu`,[xi,bi]],[`Equal`,[aa]],[`Erf`,[Ci]],[`Exp`,[wi]],[`Expand`,[$o]],[`FastGelu`,[ns]],[`Floor`,[Ti]],[`FusedConv`,[po,co]],[`Gather`,[ss,os]],[`GatherElements`,[xs,bs]],[`GatherBlockQuantized`,[hs,gs]],[`GatherND`,[us,ds]],[`Gelu`,[Ei]],[`Gemm`,[Es,Ts]],[`GlobalAveragePool`,[nl,tl]],[`GlobalMaxPool`,[sl,ol]],[`Greater`,[la]],[`GreaterOrEqual`,[da]],[`GridSample`,[Bs,Vs]],[`GroupQueryAttention`,[pc]],[`HardSigmoid`,[Pi,Ni]],[`InstanceNormalization`,[vc]],[`LayerNormalization`,[Sc]],[`LeakyRelu`,[Di,bi]],[`Less`,[ua]],[`LessOrEqual`,[fa]],[`Log`,[Gi]],[`MatMul`,[Tc]],[`MatMulNBits`,[Ac,jc]],[`MaxPool`,[il,al]],[`Mul`,[oa]],[`MultiHeadAttention`,[Ys,Gs]],[`Neg`,[ki]],[`Not`,[Oi]],[`Pad`,[Vc]],[`Pow`,[sa]],[`QuickGelu`,[Ji,bi]],[`Range`,[gl]],[`Reciprocal`,[Ai]],[`ReduceMin`,[Ar]],[`ReduceMean`,[Er]],[`ReduceMax`,[kr]],[`ReduceSum`,[Mr]],[`ReduceProd`,[jr]],[`ReduceL1`,[Q]],[`ReduceL2`,[Dr]],[`ReduceLogSum`,[Pr]],[`ReduceLogSumExp`,[Or]],[`ReduceSumSquare`,[Nr]],[`Relu`,[ji]],[`Resize`,[Vl,Hl]],[`RotaryEmbedding`,[sc]],[`ScatterND`,[xl,bl]],[`Sigmoid`,[Mi]],[`Sin`,[Fi]],[`Sinh`,[Ii]],[`Slice`,[eu,tu]],[`SkipLayerNormalization`,[Kl]],[`Split`,[nc,rc]],[`Sqrt`,[Li]],[`Softmax`,[au,ou]],[`Sub`,[ca]],[`Tan`,[Ri]],[`Tanh`,[Bi]],[`ThresholdedRelu`,[Wi,bi]],[`Tile`,[fu]],[`Transpose`,[Vn,Hn]],[`Where`,[gu]]])}),bu,xu=c(()=>{Me(),zt(),Y(),bu=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,n,r,i){ye(e.programInfo.name);let a=this.backend.device,o=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let s=[];for(let e of t)s.push({binding:s.length,resource:{buffer:e.buffer}});for(let e of n)s.push({binding:s.length,resource:{buffer:e.buffer}});i&&s.push({binding:s.length,resource:i});let c=a.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:s,label:e.programInfo.name});if(this.backend.sessionStatus===`capturing`){let t={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:c,dispatchGroup:r};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(t)}o.setPipeline(e.computePipeline),o.setBindGroup(0,c),o.dispatchWorkgroups(...r),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType===`at-passes`)&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),be(e.programInfo.name)}dispose(){}build(e,t){ye(e.name);let n=this.backend.device,r=[];[{feature:`shader-f16`,extension:`f16`},{feature:`subgroups`,extension:`subgroups`}].forEach(e=>{n.features.has(e.feature)&&r.push(`enable ${e.extension};`)});let i=Nn(t,this.backend.device.limits),a=e.getShaderSource(i),o=`${r.join(`
`)}
${i.additionalImplementations}
${a}`,s=n.createShaderModule({code:o,label:e.name});R(`verbose`,()=>`[WebGPU] ${e.name} shader code: ${o}`);let c=n.createComputePipeline({compute:{module:s,entryPoint:`main`},layout:`auto`,label:e.name});return be(e.name),{programInfo:e,computePipeline:c,uniformVariablesInfo:i.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e==`number`?e:e.x,n=typeof e==`number`?1:e.y||1,r=typeof e==`number`?1:e.z||1,i=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=i&&n<=i&&r<=i)return[t,n,r];let a=t*n*r,o=Math.ceil(Math.sqrt(a));if(o>i){if(o=Math.ceil(Math.cbrt(a)),o>i)throw Error(`Total dispatch size exceeds WebGPU maximum.`);return[o,o,o]}else return[o,o,1]}}}),Su={};l(Su,{WebGpuBackend:()=>Eu});var Cu,wu,Tu,Eu,Du=c(()=>{Me(),L(),zt(),qt(),xn(),yu(),xu(),Cu=(e,t)=>{if(t.length!==e.length)throw Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let n=[];for(let r=0;r<e.length;++r){let i=e[r].dataType;switch(t[r]){case`none`:n.push(``);break;case`type`:n.push(`${i}`);break;case`rank`:{let t=e[r].dims.length;n.push(`${i};${t}`);break}case`dims`:{let t=e[r].dims.join(`,`);n.push(`${i};${t}`);break}default:throw Error(`unsupported input dependency: ${t[r]}`)}}return n.join(`|`)},wu=(e,t,n)=>{var r,i,a;let o=e.name;return(r=e.shaderCache)!=null&&r.hint&&(o+=`[`+e.shaderCache.hint+`]`),o+=`:`+n+`:${Cu(t,(i=(a=e.shaderCache)==null?void 0:a.inputDependencies)==null?Array(t.length).fill(`dims`):i)}`,o},Tu=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},Eu=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus=`default`,this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw Error(`currentKernelCustomData(): currentKernelId is null. (should not happen)`);let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){var n;this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},a=e=>t.features.has(e)&&r.push(e)&&!0;a(`chromium-experimental-timestamp-query-inside-passes`)||a(`timestamp-query`),a(`shader-f16`),a(`subgroups`),this.device=await t.requestDevice(i);let o=t,s=(n=t.info)==null?typeof o.requestAdapterInfo==`function`?await o.requestAdapterInfo():void 0:n;this.adapterInfo=new Tu(s),this.gpuDataManager=bn(this),this.programManager=new bu(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,Lt(e.logLevel,!!e.debug),this.device.onuncapturederror=e=>{e.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${e.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){var e;typeof this.querySet<`u`&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&(e=this.env)!=null&&e.webgpu&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType===`at-passes`&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;ye(),this.endComputePass();let e;this.queryType!==`none`&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!==`none`&&e.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigUint64Array(e.getMappedRange()),n=this.pendingQueries.get(e);for(let e=0;e<t.length/2;e++){var r;let i=n[e],a=i.kernelId,o=this.kernels.get(a),s=o.kernelType,c=o.kernelName,l=i.programName,u=i.inputTensorViews,d=i.outputTensorViews,f=t[e*2],p=t[e*2+1];typeof this.queryTimeBase>`u`&&(this.queryTimeBase=f);let m=Number(f-this.queryTimeBase),h=Number(p-this.queryTimeBase);if(!Number.isSafeInteger(m)||!Number.isSafeInteger(h))throw RangeError(`incorrect timestamp range`);if((r=this.env.webgpu.profiling)!=null&&r.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:u.map(e=>({dims:e.dims,dataType:F(e.dataType)})),outputsMetadata:d.map(e=>({dims:e.dims,dataType:F(e.dataType)})),kernelId:a,kernelType:s,kernelName:c,programName:l,startTime:m,endTime:h});else{let e=``;u.forEach((t,n)=>{e+=`input[${n}]: [${t.dims}] | ${F(t.dataType)}, `});let t=``;d.forEach((e,n)=>{t+=`output[${n}]: [${e.dims}] | ${F(e.dataType)}, `}),console.log(`[profiling] kernel "${a}|${s}|${c}|${l}" ${e}${t}start time: ${m} ns, execution time: ${h-m} ns`)}_e(`GPU`,`${l}::${f}::${p}`)}e.unmap(),this.pendingQueries.delete(e)}),be()}run(e,t,n,r,i,a){ye(e.name);let o=[];for(let e=0;e<t.length;++e){let n=t[e].data;if(n===0)continue;let r=this.gpuDataManager.get(n);if(!r)throw Error(`no GPU data for input: ${n}`);o.push(r)}let{outputs:s,dispatchGroup:c,programUniforms:l}=e.getRunData(t),u=n.length===0?s.map((e,t)=>t):n;if(u.length!==s.length)throw Error(`Output size ${u.length} must be equal to ${s.length}.`);let d=[],f=[];for(let e=0;e<s.length;++e){if(!Number.isInteger(u[e])||u[e]<-3||u[e]>=a)throw Error(`Invalid output index: ${u[e]}`);if(u[e]===-3)continue;let t=u[e]===-1,n=u[e]===-2,o=t||n?i(s[e].dataType,s[e].dims):r(u[e],s[e].dataType,s[e].dims);if(d.push(o),o.data===0)continue;let c=this.gpuDataManager.get(o.data);if(!c)throw Error(`no GPU data for output: ${o.data}`);if(t&&this.temporaryData.push(c),n){let e=this.kernelPersistentData.get(this.currentKernelId);e||(e=[],this.kernelPersistentData.set(this.currentKernelId,e)),e.push(c)}f.push(c)}if(o.length!==t.length||f.length!==d.length){if(f.length===0)return be(e.name),d;throw Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let p;if(l){let e=0,t=[];l.forEach(n=>{let r=typeof n.data==`number`?[n.data]:n.data;if(r.length===0)return;let i=n.type===10?2:4,a,o;n.type===10?(o=r.length>4?16:r.length>2?8:r.length*i,a=r.length>4?16:i*r.length):(o=r.length<=2?r.length*i:16,a=16),e=Math.ceil(e/o)*o,t.push(e);let s=n.type===10?8:4;e+=r.length>4?Math.ceil(r.length/s)*a:r.length*i}),e=Math.ceil(e/16)*16;let n=new ArrayBuffer(e);l.forEach((e,r)=>{let i=t[r],a=typeof e.data==`number`?[e.data]:e.data;if(e.type===6)new Int32Array(n,i,a.length).set(a);else if(e.type===12)new Uint32Array(n,i,a.length).set(a);else if(e.type===10)new Uint16Array(n,i,a.length).set(a);else if(e.type===1)new Float32Array(n,i,a.length).set(a);else throw Error(`Unsupported uniform type: ${F(e.type)}`)});let r=this.gpuDataManager.create(e,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(r.buffer,0,n,0,e),this.gpuDataManager.release(r.id),p={offset:0,size:e,buffer:r.buffer}}let m=this.programManager.normalizeDispatchGroupSize(c),h=m[1]===1&&m[2]===1,g=wu(e,t,h),_=this.programManager.getArtifact(g);if(_||(_=this.programManager.build(e,m),this.programManager.setArtifact(g,_),R(`info`,()=>`[artifact] key: ${g}, programName: ${e.name}`)),l&&_.uniformVariablesInfo){if(l.length!==_.uniformVariablesInfo.length)throw Error(`Uniform variables count mismatch: expect ${_.uniformVariablesInfo.length}, got ${l.length} in program "${_.programInfo.name}".`);for(let e=0;e<l.length;e++){let t=l[e],n=t.type,r=typeof t.data==`number`?1:t.data.length,[i,a]=_.uniformVariablesInfo[e];if(n!==i||r!==a)throw Error(`Uniform variable ${e} mismatch: expect type ${i} with size ${a}, got type ${n} with size ${r} in program "${_.programInfo.name}".`)}}if(R(`info`,()=>`[ProgramManager] run "${e.name}" (key=${g}) with ${m[0]}x${m[1]}x${m[2]}`),this.queryType!==`none`||this.sessionStatus===`capturing`){let e={kernelId:this.currentKernelId,programName:_.programInfo.name,inputTensorViews:t,outputTensorViews:d};this.pendingKernels.push(e),this.sessionStatus===`capturing`&&this.capturedPendingKernels.get(this.currentSessionId).push(e)}return this.programManager.run(_,o,f,m,p),be(e.name),d}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,n,r){let i=vu.get(e);if(!i)throw Error(`kernel not implemented: ${e}`);let a={kernelType:e,kernelName:r,kernelEntry:i[0],attributes:[i[1],n]};this.kernels.set(t,a)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let e of t)this.gpuDataManager.release(e.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,n){let r=this.kernels.get(e);if(!r)throw Error(`kernel not created: ${e}`);let i=r.kernelType,a=r.kernelName,o=r.kernelEntry,s=r.attributes;if(this.currentKernelId!==null)throw Error(`kernel "[${i}] ${a}" is not allowed to be called recursively`);this.currentKernelId=e,s[0]&&(s[1]=s[0](s[1]),s[0]=void 0),R(`info`,()=>`[WebGPU] Start to run kernel "[${i}] ${a}"...`);let c=this.env.debug;this.temporaryData=[];try{return c&&this.device.pushErrorScope(`validation`),o(t,s[1]),0}catch(e){return n.push(Promise.resolve(`[WebGPU] Kernel "[${i}] ${a}" failed. ${e}`)),1}finally{c&&n.push(this.device.popErrorScope().then(e=>e?`GPU validation error for kernel "[${i}] ${a}": ${e.message}`:null));for(let e of this.temporaryData)this.gpuDataManager.release(e.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,n,r){let i=this.sessionExternalDataMapping.get(e);i||(i=new Map,this.sessionExternalDataMapping.set(e,i));let a=i.get(t),o=this.gpuDataManager.registerExternalBuffer(n,r,a);return i.set(t,[o,n]),o}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(e=>this.gpuDataManager.unregisterExternalBuffer(e[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,n){return async()=>{let r=await vn(this,e,t);return Kt(r.buffer,n)}}writeTimestamp(e){this.queryType===`inside-passes`&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){var e;this.queryType=`none`,(((e=this.env.webgpu.profiling)==null?void 0:e.mode)==="default"||(typeof this.env.trace>`u`?this.env.wasm.trace:this.env.trace))&&(this.device.features.has(`chromium-experimental-timestamp-query-inside-passes`)?this.queryType=`inside-passes`:this.device.features.has(`timestamp-query`)&&(this.queryType=`at-passes`),this.queryType!==`none`&&typeof this.querySet>`u`&&(this.querySet=this.device.createQuerySet({type:`timestamp`,count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){R(`info`,`captureBegin`),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus=`capturing`}captureEnd(){R(`info`,`captureEnd`),this.flush(),this.sessionStatus=`default`}replay(){R(`info`,`replay`),this.sessionStatus=`replaying`;let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),n=e.length;this.pendingKernels=[];for(let r=0;r<n;r++){let n=this.getComputePassEncoder(),i=e[r];this.writeTimestamp(this.pendingDispatchNumber*2),n.setPipeline(i.computePipeline),n.setBindGroup(0,i.bindGroup),n.dispatchWorkgroups(...i.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!==`none`&&this.pendingKernels.push(t[r]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType===`at-passes`)&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus=`default`}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),Ou={};l(Ou,{init:()=>ju});var ku,Au,ju,Mu=c(()=>{L(),zt(),B(),un(),ku=class e{constructor(e,t,n,r){this.module=e,this.dataType=t,this.data=n,this.dims=r}getFloat32Array(){if(this.dataType!==1)throw Error(`Invalid data type`);let e=z.size(this.dims);return e===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,e)}getBigInt64Array(){if(this.dataType!==7)throw Error(`Invalid data type`);let e=z.size(this.dims);return e===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,e)}getInt32Array(){if(this.dataType!==6)throw Error(`Invalid data type`);let e=z.size(this.dims);return e===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,e)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw Error(`Invalid data type`);let e=z.size(this.dims);return e===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,e)}reshape(t){if(z.size(t)!==z.size(this.dims))throw Error(`Invalid new shape`);return new e(this.module,this.dataType,this.data,t)}},Au=class{constructor(e,t,n){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let r=e.PTR_SIZE,i=n/e.PTR_SIZE,a=r===4?`i32`:`i64`;this.opKernelContext=Number(e.getValue(r*i++,a));let o=Number(e.getValue(r*i++,a));this.outputCount=Number(e.getValue(r*i++,a)),this.customDataOffset=Number(e.getValue(r*i++,`*`)),this.customDataSize=Number(e.getValue(r*i++,a));let s=[];for(let t=0;t<o;t++){let t=Number(e.getValue(r*i++,a)),n=Number(e.getValue(r*i++,`*`)),o=Number(e.getValue(r*i++,a)),c=[];for(let t=0;t<o;t++)c.push(Number(e.getValue(r*i++,a)));s.push(new ku(e,t,n,c))}this.inputs=s}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){var n,r,i;let a=(n=t==null||(r=t.inputs)==null?void 0:r.map(e=>typeof e==`number`?this.inputs[e]:e))==null?this.inputs:n,o=(i=t==null?void 0:t.outputs)==null?[]:i;return this.backend.run(e,a,o,(e,t,n)=>new ku(this.module,t,this.output(e,n),n),(e,t)=>{let n=I(e,t);if(!n)throw Error(`Unsupported data type: ${e}`);let r=n>0?this.backend.gpuDataManager.create(n).id:0;return new ku(this.module,e,r,t)},this.outputCount)}output(e,t){let n=this.module.stackSave();try{let n=this.module.PTR_SIZE,r=n===4?`i32`:`i64`,i=this.module.stackAlloc((1+t.length)*n);this.module.setValue(i,t.length,r);for(let e=0;e<t.length;e++)this.module.setValue(i+n*(e+1),t[e],r);return this.module._JsepOutput(this.opKernelContext,e,i)}catch(n){throw Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${n}`)}finally{this.module.stackRestore(n)}}},ju=async(e,t,n,r)=>{let i=t.jsepInit;if(!i)throw Error(`Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.`);if(e===`webgpu`){let e=(Du(),d(Su)).WebGpuBackend,a=new e;await a.initialize(n,r),i(`webgpu`,[a,e=>a.alloc(Number(e)),e=>a.free(e),(e,n,r,i=!1)=>{if(i)R(`verbose`,()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(e)}, dst=${Number(n)}, size=${Number(r)}`),a.memcpy(Number(e),Number(n));else{R(`verbose`,()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(e)}, gpuDataId=${Number(n)}, size=${Number(r)}`);let i=t.HEAPU8.subarray(Number(e>>>0),Number(e>>>0)+Number(r));a.upload(Number(n),i)}},async(e,n,r)=>{R(`verbose`,()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${e}, dataOffset=${n}, size=${r}`),await a.download(Number(e),()=>t.HEAPU8.subarray(Number(n)>>>0,Number(n+r)>>>0))},(e,n,r)=>a.createKernel(e,Number(n),r,t.UTF8ToString(t._JsepGetNodeName(Number(n)))),e=>a.releaseKernel(e),(e,n,r,i)=>{R(`verbose`,()=>`[WebGPU] jsepRun: sessionHandle=${r}, kernel=${e}, contextDataOffset=${n}`);let o=new Au(t,a,Number(n));return a.computeKernel(Number(e),o,i)},()=>a.captureBegin(),()=>a.captureEnd(),()=>a.replay()])}else{let e=new ln(n);i(`webnn`,[e,()=>e.reserveTensorId(),t=>e.releaseTensorId(t),async(t,n,r,i,a)=>e.ensureTensor(t,n,r,i,a),(t,n)=>{e.uploadTensor(t,n)},async(t,n)=>e.downloadTensor(t,n),(t,n)=>e.registerMLContext(t,n),!!n.trace])}}}),Nu,Pu,Fu,Iu,Lu,Ru,zu,Bu,Vu,Hu,Uu,Wu,Gu,Ku=c(()=>{Me(),_t(),wt(),L(),ft(),ht(),Mt(),Nu=(e,t)=>{N()._OrtInit(e,t)!==0&&P(`Can't initialize onnxruntime.`)},Pu=async e=>{Nu(e.wasm.numThreads,Dt(e.logLevel))},Fu=async(e,t)=>{var n,r;(n=(r=N()).asyncInit)==null||n.call(r);let i=e.webgpu.adapter;if(t===`webgpu`){if(typeof navigator>`u`||!navigator.gpu)throw Error(`WebGPU is not supported in current environment`);if(i){if(typeof i.limits!=`object`||typeof i.features!=`object`||typeof i.requestDevice!=`function`)throw Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let t=e.webgpu.powerPreference;if(t!==void 0&&t!==`low-power`&&t!==`high-performance`)throw Error(`Invalid powerPreference setting: "${t}"`);let n=e.webgpu.forceFallbackAdapter;if(n!==void 0&&typeof n!=`boolean`)throw Error(`Invalid forceFallbackAdapter setting: "${n}"`);if(i=await navigator.gpu.requestAdapter({powerPreference:t,forceFallbackAdapter:n}),!i)throw Error(`Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.`)}}if(t===`webnn`&&(typeof navigator>`u`||!navigator.ml))throw Error(`WebNN is not supported in current environment`);{let n=(Mu(),d(Ou)).init;t===`webgpu`&&await n(`webgpu`,N(),e,i),t===`webnn`&&await n(`webnn`,N(),e)}},Iu=new Map,Lu=e=>{let t=N(),n=t.stackSave();try{let n=t.PTR_SIZE,r=t.stackAlloc(2*n);t._OrtGetInputOutputCount(e,r,r+n)!==0&&P(`Can't get session input/output count.`);let i=n===4?`i32`:`i64`;return[Number(t.getValue(r,i)),Number(t.getValue(r+n,i))]}finally{t.stackRestore(n)}},Ru=(e,t)=>{let n=N(),r=n.stackSave(),i=0;try{let r=n.PTR_SIZE,a=n.stackAlloc(2*r);n._OrtGetInputOutputMetadata(e,t,a,a+r)!==0&&P(`Can't get session input/output metadata.`);let o=Number(n.getValue(a,`*`));i=Number(n.getValue(a+r,`*`));let s=n.HEAP32[i/4];if(s===0)return[o,0];let c=n.HEAPU32[i/4+1],l=[];for(let e=0;e<c;e++){let t=Number(n.getValue(i+8+e*r,`*`));l.push(t===0?Number(n.getValue(i+8+(e+c)*r,`*`)):n.UTF8ToString(t))}return[o,s,l]}finally{n.stackRestore(r),i!==0&&n._OrtFree(i)}},zu=e=>{let t=N(),n=t._malloc(e.byteLength);if(n===0)throw Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,n),[n,e.byteLength]},Bu=async(e,t)=>{let n,r,i=N();Array.isArray(e)?[n,r]=e:e.buffer===i.HEAPU8.buffer?[n,r]=[e.byteOffset,e.byteLength]:[n,r]=zu(e);let a=0,o=0,s=0,c=[],l=[],u=[];try{var d,f,p;if([o,c]=await Ct(t),t!=null&&t.externalData&&i.mountExternalData){let e=[];for(let n of t.externalData){let t=typeof n==`string`?n:n.path;e.push(jt(typeof n==`string`?n:n.data).then(e=>{i.mountExternalData(t,e)}))}await Promise.all(e)}for(let e of(d=t==null?void 0:t.executionProviders)==null?[]:d)if((typeof e==`string`?e:e.name)===`webnn`){if(i.shouldTransferToMLTensor=!1,typeof e!=`string`){let t=e,n=t==null?void 0:t.context,r=t==null?void 0:t.gpuDevice,a=t==null?void 0:t.deviceType,o=t==null?void 0:t.powerPreference;n?i.currentContext=n:r?i.currentContext=await i.webnnCreateMLContext(r):i.currentContext=await i.webnnCreateMLContext({deviceType:a,powerPreference:o})}else i.currentContext=await i.webnnCreateMLContext();break}a=await i._OrtCreateSession(n,r,o),(f=i.webgpuOnCreateSession)==null||f.call(i,a),a===0&&P(`Can't create a session.`),(p=i.jsepOnCreateSession)==null||p.call(i),i.currentContext&&(i.webnnRegisterMLContext(a,i.currentContext),i.currentContext=void 0,i.shouldTransferToMLTensor=!0);let[e,g]=Lu(a),_=!!(t!=null&&t.enableGraphCapture),v=[],y=[],b=[],x=[],S=[];for(let t=0;t<e;t++){let[e,n,r]=Ru(a,t);e===0&&P(`Can't get an input name.`),l.push(e);let o=i.UTF8ToString(e);v.push(o),b.push(n===0?{name:o,isTensor:!1}:{name:o,isTensor:!0,type:F(n),shape:r})}for(let n=0;n<g;n++){let[r,o,s]=Ru(a,n+e);r===0&&P(`Can't get an output name.`),u.push(r);let c=i.UTF8ToString(r);y.push(c),x.push(o===0?{name:c,isTensor:!1}:{name:c,isTensor:!0,type:F(o),shape:s});{var m,h;if(_&&(t==null?void 0:t.preferredOutputLocation)===void 0){S.push(`gpu-buffer`);continue}let e=typeof(t==null?void 0:t.preferredOutputLocation)==`string`?t.preferredOutputLocation:(m=t==null||(h=t.preferredOutputLocation)==null?void 0:h[c])==null?`cpu`:m,n=i.webnnIsGraphOutput;if(e===`cpu`&&n&&n(a,c)){S.push(`ml-tensor-cpu-output`);continue}if(e!==`cpu`&&e!==`cpu-pinned`&&e!==`gpu-buffer`&&e!==`ml-tensor`)throw Error(`Not supported preferred output location: ${e}.`);if(_&&e!==`gpu-buffer`)throw Error(`Not supported preferred output location: ${e}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);S.push(e)}}let C=null;return S.some(e=>e===`gpu-buffer`||e===`ml-tensor`||e===`ml-tensor-cpu-output`)&&(s=i._OrtCreateBinding(a),s===0&&P(`Can't create IO binding.`),C={handle:s,outputPreferredLocations:S,outputPreferredLocationsEncoded:S.map(e=>e===`ml-tensor-cpu-output`?`ml-tensor`:e).map(e=>At(e))}),Iu.set(a,[a,l,u,C,_,!1]),[a,v,y,b,x]}catch(e){throw l.forEach(e=>i._OrtFree(e)),u.forEach(e=>i._OrtFree(e)),s!==0&&i._OrtReleaseBinding(s)!==0&&P(`Can't release IO binding.`),a!==0&&i._OrtReleaseSession(a)!==0&&P(`Can't release session.`),e}finally{var g;i._free(n),o!==0&&i._OrtReleaseSessionOptions(o)!==0&&P(`Can't release session options.`),c.forEach(e=>i._free(e)),(g=i.unmountExternalData)==null||g.call(i)}},Vu=e=>{var t,n,r;let i=N(),a=Iu.get(e);if(!a)throw Error(`cannot release session. invalid session id: ${e}`);let[o,s,c,l,u]=a;l&&(u&&i._OrtClearBoundOutputs(l.handle)!==0&&P(`Can't clear bound outputs.`),i._OrtReleaseBinding(l.handle)!==0&&P(`Can't release IO binding.`)),(t=i.jsepOnReleaseSession)==null||t.call(i,e),(n=i.webnnOnReleaseSession)==null||n.call(i,e),(r=i.webgpuOnReleaseSession)==null||r.call(i,e),s.forEach(e=>i._OrtFree(e)),c.forEach(e=>i._OrtFree(e)),i._OrtReleaseSession(o)!==0&&P(`Can't release session.`),Iu.delete(e)},Hu=async(e,t,n,r,i,a,o=!1)=>{if(!e){t.push(0);return}let s=N(),c=s.PTR_SIZE,l=e[0],u=e[1],d=e[3],f=d,p,m;if(l===`string`&&(d===`gpu-buffer`||d===`ml-tensor`))throw Error(`String tensor is not supported on GPU.`);if(o&&d!==`gpu-buffer`)throw Error(`External buffer must be provided for input/output index ${a} when enableGraphCapture is true.`);if(d===`gpu-buffer`){let t=e[2].gpuBuffer;m=I(Tt(l),u);{let e=s.jsepRegisterBuffer;if(!e)throw Error(`Tensor location "gpu-buffer" is not supported without using WebGPU.`);p=e(r,a,t,m)}}else if(d===`ml-tensor`){let t=e[2].mlTensor;m=I(Tt(l),u);let n=s.webnnRegisterMLTensor;if(!n)throw Error(`Tensor location "ml-tensor" is not supported without using WebNN.`);p=n(r,t,Tt(l),u)}else{let t=e[2];if(Array.isArray(t)){m=c*t.length,p=s._malloc(m),n.push(p);for(let e=0;e<t.length;e++){if(typeof t[e]!=`string`)throw TypeError(`tensor data at index ${e} is not a string`);s.setValue(p+e*c,pt(t[e],n),`*`)}}else{let e=s.webnnIsGraphInput,a=s.webnnIsGraphOutput;if(l!==`string`&&e&&a){let o=s.UTF8ToString(i);if(e(r,o)||a(r,o)){let e=Tt(l);m=I(e,u),f=`ml-tensor`;let n=s.webnnCreateTemporaryTensor,i=s.webnnUploadTensor;if(!n||!i)throw Error(`Tensor location "ml-tensor" is not supported without using WebNN.`);let a=await n(r,e,u);i(a,new Uint8Array(t.buffer,t.byteOffset,t.byteLength)),p=a}else m=t.byteLength,p=s._malloc(m),n.push(p),s.HEAPU8.set(new Uint8Array(t.buffer,t.byteOffset,m),p)}else m=t.byteLength,p=s._malloc(m),n.push(p),s.HEAPU8.set(new Uint8Array(t.buffer,t.byteOffset,m),p)}}let h=s.stackSave(),g=s.stackAlloc(4*u.length);try{u.forEach((e,t)=>s.setValue(g+t*c,e,c===4?`i32`:`i64`));let e=s._OrtCreateTensor(Tt(l),p,m,g,u.length,At(f));e===0&&P(`Can't create tensor for input/output. session=${r}, index=${a}.`),t.push(e)}finally{s.stackRestore(h)}},Uu=async(e,t,n,r,i,a)=>{let o=N(),s=o.PTR_SIZE,c=Iu.get(e);if(!c)throw Error(`cannot run inference. invalid session id: ${e}`);let l=c[0],u=c[1],d=c[2],f=c[3],p=c[4],m=c[5],h=t.length,g=r.length,_=0,v=[],y=[],b=[],x=[],S=[],C=o.stackSave(),w=o.stackAlloc(h*s),T=o.stackAlloc(h*s),ee=o.stackAlloc(g*s),E=o.stackAlloc(g*s);try{var te,D;[_,v]=gt(a),xe(`wasm prepareInputOutputTensor`);for(let r=0;r<h;r++)await Hu(n[r],y,x,e,u[t[r]],t[r],p);for(let t=0;t<g;t++)await Hu(i[t],b,x,e,d[r[t]],h+r[t],p);j(`wasm prepareInputOutputTensor`);for(let e=0;e<h;e++)o.setValue(w+e*s,y[e],`*`),o.setValue(T+e*s,u[t[e]],`*`);for(let e=0;e<g;e++)o.setValue(ee+e*s,b[e],`*`),o.setValue(E+e*s,d[r[e]],`*`);if(f&&!m){let{handle:n,outputPreferredLocations:a,outputPreferredLocationsEncoded:s}=f;if(u.length!==h)throw Error(`input count from feeds (${h}) is expected to be always equal to model's input count (${u.length}).`);xe(`wasm bindInputsOutputs`);for(let r=0;r<h;r++){let i=t[r];await o._OrtBindInput(n,u[i],y[r])!==0&&P(`Can't bind input[${r}] for session=${e}.`)}for(let t=0;t<g;t++){var O;let c=r[t];(O=i[t])!=null&&O[3]?(S.push(b[t]),o._OrtBindOutput(n,d[c],b[t],0)!==0&&P(`Can't bind pre-allocated output[${t}] for session=${e}.`)):o._OrtBindOutput(n,d[c],0,s[c])!==0&&P(`Can't bind output[${t}] to ${a[t]} for session=${e}.`)}j(`wasm bindInputsOutputs`),Iu.set(e,[l,u,d,f,p,!0])}(te=o.jsepOnRunStart)==null||te.call(o,l),(D=o.webnnOnRunStart)==null||D.call(o,l);let c;c=f?await o._OrtRunWithBinding(l,f.handle,g,ee,_):await o._OrtRun(l,T,w,h,E,g,ee,_),c!==0&&P(`failed to call OrtRun().`);let C=[],ne=[];xe(`wasm ProcessOutputTensor`);for(let t=0;t<g;t++){let n=Number(o.getValue(ee+t*s,`*`));if(n===b[t]||S.includes(b[t])){C.push(i[t]),n!==b[t]&&o._OrtReleaseTensor(n)!==0&&P(`Can't release tensor.`);continue}let a=o.stackSave(),c=o.stackAlloc(4*s),l=!1,u,d=0;try{o._OrtGetTensorData(n,c,c+s,c+2*s,c+3*s)!==0&&P(`Can't access output tensor data on index ${t}.`);let i=s===4?`i32`:`i64`,a=Number(o.getValue(c,i));d=o.getValue(c+s,`*`);let p=o.getValue(c+s*2,`*`),m=Number(o.getValue(c+s*3,i)),h=[];for(let e=0;e<m;e++)h.push(Number(o.getValue(p+e*s,i)));o._OrtFree(p)!==0&&P(`Can't free memory for tensor dims.`);let g=h.reduce((e,t)=>e*t,1);u=F(a);let _=f==null?void 0:f.outputPreferredLocations[r[t]];if(u===`string`){if(_===`gpu-buffer`||_===`ml-tensor`)throw Error(`String tensor is not supported on GPU.`);let e=[];for(let t=0;t<g;t++){let n=o.getValue(d+t*s,`*`),r=o.getValue(d+(t+1)*s,`*`),i=t===g-1?void 0:r-n;e.push(o.UTF8ToString(n,i))}C.push([u,h,e,`cpu`])}else if(_===`gpu-buffer`&&g>0){let e=o.jsepGetBuffer;if(!e)throw Error(`preferredLocation "gpu-buffer" is not supported without using WebGPU.`);let t=e(d),r=I(a,g);if(r===void 0||!Ot(u))throw Error(`Unsupported data type: ${u}`);l=!0,C.push([u,h,{gpuBuffer:t,download:o.jsepCreateDownloader(t,r,u),dispose:()=>{o._OrtReleaseTensor(n)!==0&&P(`Can't release tensor.`)}},`gpu-buffer`])}else if(_===`ml-tensor`&&g>0){let t=o.webnnEnsureTensor,r=o.webnnIsGraphInputOutputTypeSupported;if(!t||!r)throw Error(`preferredLocation "ml-tensor" is not supported without using WebNN.`);if(I(a,g)===void 0||!kt(u))throw Error(`Unsupported data type: ${u}`);if(!r(e,u,!1))throw Error(`preferredLocation "ml-tensor" for ${u} output is not supported by current WebNN Context.`);let i=await t(e,d,a,h,!1);l=!0,C.push([u,h,{mlTensor:i,download:o.webnnCreateMLTensorDownloader(d,u),dispose:()=>{o.webnnReleaseTensorId(d),o._OrtReleaseTensor(n)}},`ml-tensor`])}else if(_===`ml-tensor-cpu-output`&&g>0){let e=o.webnnCreateMLTensorDownloader(d,u)(),t=C.length;l=!0,ne.push((async()=>{let r=[t,await e];return o.webnnReleaseTensorId(d),o._OrtReleaseTensor(n),r})()),C.push([u,h,[],`cpu`])}else{let e=new(Et(u))(g);new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(o.HEAPU8.subarray(d,d+e.byteLength)),C.push([u,h,e,`cpu`])}}finally{o.stackRestore(a),u===`string`&&d&&o._free(d),l||o._OrtReleaseTensor(n)}}f&&!p&&(o._OrtClearBoundOutputs(f.handle)!==0&&P(`Can't clear bound outputs.`),Iu.set(e,[l,u,d,f,p,!1]));for(let[e,t]of await Promise.all(ne))C[e][2]=t;return j(`wasm ProcessOutputTensor`),C}finally{var ne;(ne=o.webnnOnRunEnd)==null||ne.call(o,l),o.stackRestore(C),y.forEach(e=>o._OrtReleaseTensor(e)),b.forEach(e=>o._OrtReleaseTensor(e)),x.forEach(e=>o._free(e)),_!==0&&o._OrtReleaseRunOptions(_),v.forEach(e=>o._free(e))}},Wu=e=>{let t=N(),n=Iu.get(e);if(!n)throw Error(`invalid session id`);let r=n[0],i=t._OrtEndProfiling(r);i===0&&P(`Can't get an profile file name.`),t._OrtFree(i)},Gu=e=>{let t=[];for(let n of e){let e=n[2];!Array.isArray(e)&&`buffer`in e&&t.push(e.buffer)}return t}}),qu,Ju,Yu,Xu,Zu,Qu,$u,ed,td,nd,rd,id,ad,od,sd,cd,ld,ud,dd=c(()=>{Me(),Ku(),ft(),rt(),qu=()=>!!w.wasm.proxy&&typeof document<`u`,Yu=!1,Xu=!1,Zu=!1,ed=new Map,td=(e,t)=>{let n=ed.get(e);n?n.push(t):ed.set(e,[t])},nd=()=>{if(Yu||!Xu||Zu||!Ju)throw Error(`worker not ready`)},rd=e=>{switch(e.data.type){case`init-wasm`:Yu=!1,e.data.err?(Zu=!0,$u[1](e.data.err)):(Xu=!0,$u[0]()),Qu&&(URL.revokeObjectURL(Qu),Qu=void 0);break;case`init-ep`:case`copy-from`:case`create`:case`release`:case`run`:case`end-profiling`:{let t=ed.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}default:}},id=async()=>{if(!Xu){if(Yu)throw Error(`multiple calls to 'initWasm()' detected.`);if(Zu)throw Error(`previous call to 'initWasm()' failed.`);if(Yu=!0,qu())return new Promise((e,t)=>{Ju==null||Ju.terminate(),tt().then(([n,r])=>{try{Ju=r,Ju.onerror=e=>t(e),Ju.onmessage=rd,$u=[e,t];let i={type:`init-wasm`,in:w};!i.in.wasm.wasmPaths&&(n||Ge)&&(i.in.wasm.wasmPaths={wasm:new URL(`/assets/ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm`,``+import.meta.url).href}),Ju.postMessage(i),Qu=n}catch(e){t(e)}},t)});try{await dt(w.wasm),await Pu(w),Xu=!0}catch(e){throw Zu=!0,e}finally{Yu=!1}}},ad=async e=>{if(qu())return nd(),new Promise((t,n)=>{td(`init-ep`,[t,n]);let r={type:`init-ep`,in:{epName:e,env:w}};Ju.postMessage(r)});await Fu(w,e)},od=async e=>qu()?(nd(),new Promise((t,n)=>{td(`copy-from`,[t,n]);let r={type:`copy-from`,in:{buffer:e}};Ju.postMessage(r,[e.buffer])})):zu(e),sd=async(e,t)=>{if(qu()){if(t!=null&&t.preferredOutputLocation)throw Error(`session option "preferredOutputLocation" is not supported for proxy.`);return nd(),new Promise((n,r)=>{td(`create`,[n,r]);let i={type:`create`,in:{model:e,options:{...t}}},a=[];e instanceof Uint8Array&&a.push(e.buffer),Ju.postMessage(i,a)})}else return Bu(e,t)},cd=async e=>{if(qu())return nd(),new Promise((t,n)=>{td(`release`,[t,n]);let r={type:`release`,in:e};Ju.postMessage(r)});Vu(e)},ld=async(e,t,n,r,i,a)=>{if(qu()){if(n.some(e=>e[3]!==`cpu`))throw Error(`input tensor on GPU is not supported for proxy.`);if(i.some(e=>e))throw Error(`pre-allocated output tensor is not supported for proxy.`);return nd(),new Promise((i,o)=>{td(`run`,[i,o]);let s=n,c={type:`run`,in:{sessionId:e,inputIndices:t,inputs:s,outputIndices:r,options:a}};Ju.postMessage(c,Gu(s))})}else return Uu(e,t,n,r,i,a)},ud=async e=>{if(qu())return nd(),new Promise((t,n)=>{td(`end-profiling`,[t,n]);let r={type:`end-profiling`,in:e};Ju.postMessage(r)});Wu(e)}}),fd,pd,md,hd=c(()=>{Me(),dd(),L(),Ne(),Mt(),fd=(e,t)=>{switch(e.location){case`cpu`:return[e.type,e.dims,e.data,`cpu`];case`gpu-buffer`:return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},`gpu-buffer`];case`ml-tensor`:return[e.type,e.dims,{mlTensor:e.mlTensor},`ml-tensor`];default:throw Error(`invalid data location: ${e.location} for ${t()}`)}},pd=e=>{switch(e[3]){case`cpu`:return new he(e[0],e[2],e[1]);case`gpu-buffer`:{let t=e[0];if(!Ot(t))throw Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:n,download:r,dispose:i}=e[2];return he.fromGpuBuffer(n,{dataType:t,dims:e[1],download:r,dispose:i})}case`ml-tensor`:{let t=e[0];if(!kt(t))throw Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:n,download:r,dispose:i}=e[2];return he.fromMLTensor(n,{dataType:t,dims:e[1],download:r,dispose:i})}default:throw Error(`invalid data location: ${e[3]}`)}},md=class{async fetchModelAndCopyToWasmMemory(e){return od(await jt(e))}async loadModel(e,t){ye();let n;n=typeof e==`string`?await this.fetchModelAndCopyToWasmMemory(e):e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await sd(n,t),be()}async dispose(){return cd(this.sessionId)}async run(e,t,n){var r;ye();let i=[],a=[];Object.entries(e).forEach(e=>{let t=e[0],n=e[1],r=this.inputNames.indexOf(t);if(r===-1)throw Error(`invalid input '${t}'`);i.push(n),a.push(r)});let o=[],s=[];Object.entries(t).forEach(e=>{let t=e[0],n=e[1],r=this.outputNames.indexOf(t);if(r===-1)throw Error(`invalid output '${t}'`);o.push(n),s.push(r)});let c=i.map((e,t)=>fd(e,()=>`input "${this.inputNames[a[t]]}"`)),l=o.map((e,t)=>e?fd(e,()=>`output "${this.outputNames[s[t]]}"`):null),u=await ld(this.sessionId,a,c,s,l,n),d={};for(let e=0;e<u.length;e++)d[this.outputNames[s[e]]]=(r=o[e])==null?pd(u[e]):r;return be(),d}startProfiling(){}endProfiling(){ud(this.sessionId)}}}),gd={};l(gd,{OnnxruntimeWebAssemblyBackend:()=>vd,initializeFlags:()=>_d,wasmBackend:()=>yd});var _d,vd,yd,bd=c(()=>{Me(),dd(),hd(),_d=()=>{(typeof w.wasm.initTimeout!=`number`||w.wasm.initTimeout<0)&&(w.wasm.initTimeout=0);let e=w.wasm.simd;if(typeof e!=`boolean`&&e!==void 0&&e!==`fixed`&&e!==`relaxed`&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),w.wasm.simd=!1),typeof w.wasm.proxy!=`boolean`&&(w.wasm.proxy=!1),typeof w.wasm.trace!=`boolean`&&(w.wasm.trace=!1),typeof w.wasm.numThreads!=`number`||!Number.isInteger(w.wasm.numThreads)||w.wasm.numThreads<=0)if(typeof self<`u`&&!self.crossOriginIsolated)w.wasm.numThreads=1;else{let e=typeof navigator>`u`?s(`node:os`).cpus().length:navigator.hardwareConcurrency;w.wasm.numThreads=Math.min(4,Math.ceil((e||1)/2))}},vd=class{async init(e){_d(),await id(),await ad(e)}async createInferenceSessionHandler(e,t){let n=new md;return await n.loadModel(e,t),n}},yd=new vd});Me(),Me(),Me();var xd=`1.27.0`,Sd=je;{let e=(bd(),d(gd)).wasmBackend;m(`webgpu`,e,5),m(`webnn`,e,5),m(`cpu`,e,10),m(`wasm`,e,10)}Object.defineProperty(w.versions,"web",{value:xd,enumerable:!0});export{Te as InferenceSession,_e as TRACE,xe as TRACE_EVENT_BEGIN,j as TRACE_EVENT_END,ye as TRACE_FUNC_BEGIN,be as TRACE_FUNC_END,he as Tensor,Sd as default,w as env,m as registerBackend};