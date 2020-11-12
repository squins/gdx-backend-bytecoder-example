var bytecoder = {

     runningInstance: undefined,
     runningInstanceMemory: undefined,
     exports: undefined,
     referenceTable: ['EMPTY'],
     callbacks: [],
     filehandles: [],

     openForRead: function(path) {
         try {
             var request = new XMLHttpRequest();
             request.open('GET',path,false);
             request.overrideMimeType('text\/plain; charset=x-user-defined');
             request.send(null);
             if (request.status == 200) {
                var length = request.getResponseHeader('content-length');
                var responsetext = request.response;
                var buf = new ArrayBuffer(responsetext.length);
                var bufView = new Uint8Array(buf);
                for (var i=0, strLen=responsetext.length; i<strLen; i++) {
                    bufView[i] = responsetext.charCodeAt(i) & 0xff;
                }
                var handle = bytecoder.filehandles.length;
                bytecoder.filehandles[handle] = {
                    currentpos: 0,
                    data: bufView,
                    size: length,
                    skip0INTINT: function(handle,amount) {
                        var remaining = this.size - this.currentpos;
                        var possible = Math.min(remaining, amount);
                        this.currentpos+=possible;
                        return possible;
                    },
                    available0INT: function(handle) {
                        return this.size - this.currentpos;
                    },
                    read0INT: function(handle) {
                        return this.data[this.currentpos++];
                    },
                    readBytesINTL1BYTEINTINT: function(handle,target,offset,length) {
                        if (length === 0) {
                            return 0;
                        }
                        var remaining = this.size - this.currentpos;
                        var possible = Math.min(remaining, length);
                        if (possible === 0) {
                            return -1;
                        }
                        for (var j=0;j<possible;j++) {
                            bytecoder.runningInstanceMemory[target + 20 + offset * 8]=this.data[this.currentpos++];
                            offset++;
                        }
                        return possible;
                    }
                };
                return handle;
            }
            return -1;
         } catch(e) {
             return -1;
         }
     },

     init: function(instance) {
         bytecoder.runningInstance = instance;
         bytecoder.runningInstanceMemory = new Uint8Array(instance.exports.memory.buffer);
         bytecoder.exports = instance.exports;
     },

     initializeFileIO: function() {
         var stddin = {
         };
         var stdout = {
             buffer: "",
             writeBytesINTL1BYTEINTINT: function(handle, data, offset, length) {
                 if (length > 0) {
                     var array = new Uint8Array(length);
                     data+=20;
                     for (var i = 0; i < length; i++) {
                         array[i] = bytecoder.intInMemory(data);
                         data+=8;
                     }
                     var asstring = String.fromCharCode.apply(null, array);
                     for (var i=0;i<asstring.length;i++) {
                         var c = asstring.charAt(i);
                         if (c == '\n') {
                             console.log(stdout.buffer);
                             stdout.buffer="";
                         } else {
                             stdout.buffer = stdout.buffer.concat(c);
                         }
                     }
                 }
             },
             close0INT: function(handle) {
             },
             writeIntINTINT: function(handle,value) {
                 var c = String.fromCharCode(value);
                 if (c == '\n') {
                     console.log(stdout.buffer);
                     stdout.buffer="";
                 } else {
                     stdout.buffer = stdout.buffer.concat(c);
                 }
             }
         };
         bytecoder.filehandles[0] = stddin;
         bytecoder.filehandles[1] = stdout;
         bytecoder.filehandles[2] = stdout;
         bytecoder.exports.initDefaultFileHandles(-1, 0,1,2);
     },

     intInMemory: function(value) {
         return bytecoder.runningInstanceMemory[value]
                + (bytecoder.runningInstanceMemory[value + 1] * 256)
                + (bytecoder.runningInstanceMemory[value + 2] * 256 * 256)
                + (bytecoder.runningInstanceMemory[value + 3] * 256 * 256 * 256);
     },

     toJSString: function(value) {
         var theByteArray = bytecoder.intInMemory(value + 16);
         var theData = bytecoder.byteArraytoJSString(theByteArray);
         return theData;
     },

     byteArraytoJSString: function(value) {
         var theLength = bytecoder.intInMemory(value + 16);
         var theData = '';
         value = value + 20;
         for (var i=0;i<theLength;i++) {
             var theCharCode = bytecoder.intInMemory(value);
             value = value + 8;
             theData+= String.fromCharCode(theCharCode);
         }
         return theData;
     },

     toBytecoderReference: function(value) {
         var index = bytecoder.referenceTable.indexOf(value);
         if (index>=0) {
             return index;
         }
         bytecoder.referenceTable.push(value);
         return bytecoder.referenceTable.length - 1;
     },

     toJSReference: function(value) {
         return bytecoder.referenceTable[value];
     },

     toBytecoderString: function(value) {
         var newArray = bytecoder.exports.newByteArray(0, value.length);
         for (var i=0;i<value.length;i++) {
             bytecoder.exports.setByteArrayEntry(0,newArray,i,value.charCodeAt(i));
         }
         return bytecoder.exports.newStringUTF8(0, newArray);
     },

     registerCallback: function(ptr,callback) {
         bytecoder.callbacks.push(ptr);
         return callback;
     },

     imports: {
         stringutf16: {
             isBigEndian: function() {return 1;},
         },
         env: {
             fmodf: function(f1,f2) {return f1 % f2;},
             fmod: function(f1,f2) {return f1 % f2;},
             debug: function(thisref, f1) {console.log(f1);}
         },
         system: {
             currentTimeMillis: function() {return Date.now();},
             nanoTime: function() {return Date.now() * 1000000;},
         },
         vm: {
             newLambdaStaticInvocationStringMethodTypeMethodHandleObject: function() {},
             newLambdaConstructorInvocationMethodTypeMethodHandleObject: function() {},
             newLambdaInterfaceInvocationMethodTypeMethodHandleObject: function() {},
             newLambdaVirtualInvocationMethodTypeMethodHandleObject: function() {},
             newLambdaSpecialInvocationMethodTypeMethodHandleObject: function() {},
         },
         memorymanager: {
             logINT: function(thisref, value) {
                     console.log('Log : ' + value);
             },
             logAllocationDetailsINTINTINT: function(thisref, current, prev, next) {
                     if (prev != 0) console.log('m_' + current + ' -> m_' + prev + '[label="Prev"]');
                     if (next != 0) console.log('m_' + current + ' -> m_' + next + '[label="Next"]');
             },
             isUsedAsCallbackINT : function(thisref, ptr) {
                 return bytecoder.callbacks.includes(ptr);
             },
             printObjectDebugInternalObjectINTINTBOOLEANBOOLEAN: function(thisref, ptr, indexAlloc, indexFree, usedByStack, usedByHeap) {
                 console.log('Memory debug for ' + ptr);
                 var theAllocatedBlock = ptr - 16;
                 var theSize = bytecoder.intInMemory(theAllocatedBlock);
                 var theNext = bytecoder.intInMemory(theAllocatedBlock +  4);
                 var theSurvivorCount = bytecoder.intInMemory(theAllocatedBlock +  8);
                 console.log(' Allocation starts at '+ theAllocatedBlock);
                 console.log(' Size = ' + theSize + ', Next = ' + theNext);
                 console.log(' GC survivor count        : ' + theSurvivorCount);
                 console.log(' Index in allocation list : ' + indexAlloc);
                 console.log(' Index in free list       : ' + indexFree);
                 console.log(' Used by STACK            : ' + usedByStack);
                 console.log(' Used by HEAP             : ' + usedByHeap);
                 for (var i=0;i<theSize;i+=4) {
                     console.log(' Memory offset +' + i + ' = ' + bytecoder.intInMemory( theAllocatedBlock + i));
                 }
             }
         },
         opaquearrays : {
             createIntArrayINT: function(thisref, p1) {
                 return bytecoder.toBytecoderReference(new Int32Array(p1));
             },
             createFloatArrayINT: function(thisref, p1) {
                 return bytecoder.toBytecoderReference(new Float32Array(p1));
             },
             createObjectArray: function(thisref) {
                 return bytecoder.toBytecoderReference([]);
             },
             createInt8ArrayINT: function(thisref, p1) {
                 return bytecoder.toBytecoderReference(new Int8Array(p1));
             },
             createInt16ArrayINT: function(thisref, p1) {
                 return bytecoder.toBytecoderReference(new Int16Array(p1));
             },
         },
         float : {
             floatToRawIntBitsFLOAT : function(thisref,value) {
                 var fl = new Float32Array(1);
                 fl[0] = value;
                 var br = new Int32Array(fl.buffer);
                 return br[0];
             },
             intBitsToFloatINT : function(thisref,value) {
                 var fl = new Int32Array(1);
                 fl[0] = value;
                 var br = new Float32Array(fl.buffer);
                 return br[0];
             },
         },
         double : {
             doubleToRawLongBitsDOUBLE : function(thisref, value) {
                 var fl = new Float64Array(1);
                 fl[0] = value;
                 var br = new BigInt64Array(fl.buffer);
                 return br[0];
             },
             longBitsToDoubleLONG : function(thisref, value) {
                 var fl = new BigInt64Array(1);
                 fl[0] = value;
                 var br = new Float64Array(fl.buffer);
                 return br[0];
             },
         },
         math: {
             floorDOUBLE: function (thisref, p1) {return Math.floor(p1);},
             ceilDOUBLE: function (thisref, p1) {return Math.ceil(p1);},
             sinDOUBLE: function (thisref, p1) {return Math.sin(p1);},
             cosDOUBLE: function  (thisref, p1) {return Math.cos(p1);},
             tanDOUBLE: function  (thisref, p1) {return Math.tan(p1);},
             roundDOUBLE: function  (thisref, p1) {return Math.round(p1);},
             sqrtDOUBLE: function(thisref, p1) {return Math.sqrt(p1);},
             cbrtDOUBLE: function(thisref, p1) {return Math.cbrt(p1);},
             add: function(thisref, p1, p2) {return p1 + p2;},
             maxLONGLONG: function(thisref, p1, p2) { return Math.max(p1, p2);},
             maxDOUBLEDOUBLE: function(thisref, p1, p2) { return Math.max(p1, p2);},
             maxINTINT: function(thisref, p1, p2) { return Math.max(p1, p2);},
             maxFLOATFLOAT: function(thisref, p1, p2) { return Math.max(p1, p2);},
             minFLOATFLOAT: function(thisref, p1, p2) { return Math.min(p1, p2);},
             minINTINT: function(thisref, p1, p2) { return Math.min(p1, p2);},
             minLONGLONG: function(thisref, p1, p2) { return Math.min(p1, p2);},
             minDOUBLEDOUBLE: function(thisref, p1, p2) { return Math.min(p1, p2);},
             toRadiansDOUBLE: function(thisref, p1) {
                 return p1 * (Math.PI / 180);
             },
             toDegreesDOUBLE: function(thisref, p1) {
                 return p1 * (180 / Math.PI);
             },
             random: function(thisref) { return Math.random();},
             logDOUBLE: function (thisref, p1) {return Math.log(p1);},
             powDOUBLEDOUBLE: function (thisref, p1, p2) {return Math.pow(p1, p2);},
             acosDOUBLE: function (thisref, p1, p2) {return Math.acos(p1);},
             atan2DOUBLE: function (thisref, p1, p2) {return Math.atan2(p1);},
         },
         strictmath: {
             floorDOUBLE: function (thisref, p1) {return Math.floor(p1);},
             ceilDOUBLE: function (thisref, p1) {return Math.ceil(p1);},
             sinDOUBLE: function (thisref, p1) {return Math.sin(p1);},
             cosDOUBLE: function  (thisref, p1) {return Math.cos(p1);},
             roundFLOAT: function  (thisref, p1) {return Math.round(p1);},
             sqrtDOUBLE: function(thisref, p1) {return Math.sqrt(p1);},
             atan2DOUBLEDOUBLE: function(thisref, p1) {return Math.sqrt(p1);},
         },
         runtime: {
             nativewindow: function(caller) {return bytecoder.toBytecoderReference(window);},
             nativeconsole: function(caller) {return bytecoder.toBytecoderReference(console);},
         },
         unixfilesystem :{
             getBooleanAttributes0String : function(thisref,path) {
                 var jsPath = bytecoder.toJSString(path);
                 try {
                     var request = new XMLHttpRequest();
                     request.open('HEAD',jsPath,false);
                     request.send(null);
                     if (request.status == 200) {
                         var length = request.getResponseHeader('content-length');
                         return 0x01;
                     }
                     return 0;
                 } catch(e) {
                     return 0;
                 }
             },
         },
         nullpointerexception : {
             getExtendedNPEMessage : function(thisref) {
                 return 0;
             },
         },
         fileoutputstream : {
             writeBytesINTL1BYTEINTINT : function(thisref, handle, data, offset, length) {
                 bytecoder.filehandles[handle].writeBytesINTL1BYTEINTINT(handle,data,offset,length);
             },
             writeIntINTINT : function(thisref, handle, intvalue) {
                 bytecoder.filehandles[handle].writeIntINTINT(handle,intvalue);
             },
             close0INT : function(thisref,handle) {
                 bytecoder.filehandles[handle].close0INT(handle);
             },
         },
         fileinputstream : {
             open0String : function(thisref,name) {
                 return bytecoder.openForRead(bytecoder.toJSString(name));
             },
             read0INT : function(thisref,handle) {
                 return bytecoder.filehandles[handle].read0INT(handle);
             },
             readBytesINTL1BYTEINTINT : function(thisref,handle,data,offset,length) {
                 return bytecoder.filehandles[handle].readBytesINTL1BYTEINTINT(handle,data,offset,length);
             },
             skip0INTINT : function(thisref,handle,amount) {
                 return bytecoder.filehandles[handle].skip0INTINT(handle,amount);
             },
             available0INT : function(thisref,handle) {
                 return bytecoder.filehandles[handle].available0INT(handle);
             },
             close0INT : function(thisref,handle) {
                 bytecoder.filehandles[handle].close0INT(handle);
             },
         },
         inflater : {
             initIDs : function(thisref) {
             },
             initBOOLEAN : function(thisref,nowrap) {
             },
             inflateBytesBytesLONGL1BYTEINTINTL1BYTEINTINT : function(thisref,addr,inputArray,inputOff,inputLen,outputArray,outputOff,outputLen) {
             },
             inflateBufferBytesLONGLONGINTL1BYTEINTINT : function(thisref,addr,inputAddress,inputLen,outputArray,outputOff,outputLen) {
             },
             endLONG : function(thisref,addr) {
             },
         },
         console: {
             logString: function(target,arg0) {
               bytecoder.referenceTable[target].log(bytecoder.toJSString(arg0));
             },
         },
         floatarray: {
             setFloatINTFLOAT: function(target,arg0,arg1) {
               bytecoder.referenceTable[target][arg0]=arg1;
             },
         },
         document: {
             createElementString: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].createElement(bytecoder.toJSString(arg0)));
             },
         },
         promise: {
             thenPromise$Handler: function(target,arg0) {
               bytecoder.referenceTable[target].then(bytecoder.registerCallback(arg0,function (farg0) {var marg0=bytecoder.toBytecoderReference(farg0);bytecoder.exports.dmbawPromise$Handler_VOIDhandleObjectdmbaOpaqueReferenceType(arg0,marg0);}));
             },
         },
         body: {
             text: function(target) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].text());
             },
         },
         eventtarget: {
             addEventListenerStringEventListener: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].addEventListener(bytecoder.toJSString(arg0),bytecoder.registerCallback(arg1,function (farg0) {var marg0=bytecoder.toBytecoderReference(farg0);bytecoder.exports.dmbawEventListener_VOIDrundmbawEvent(arg1,marg0);delete bytecoder.referenceTable[marg0];}));
             },
         },
         stringpromise: {
             thenStringPromise$Handler: function(target,arg0) {
               bytecoder.referenceTable[target].then(bytecoder.registerCallback(arg0,function (farg0) {var marg0=bytecoder.toBytecoderString(farg0);bytecoder.exports.dmbawStringPromise$Handler_VOIDhandleStringjlString(arg0,marg0);}));
             },
         },
         libgdxappcanvas: {
             assetBaseUrl: function(target) {
               return bytecoder.toBytecoderString(bytecoder.referenceTable[target].assetBaseUrl());
             },
             audioString: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].audio(bytecoder.toJSString(arg0)));
             },
         },
         int8array: {
             setByteINTBYTE: function(target,arg0,arg1) {
               bytecoder.referenceTable[target][arg0]=arg1;
             },
         },
         htmlaudioelement: {
             setSrcString: function(target,arg0) {
               bytecoder.referenceTable[target].src=bytecoder.toJSString(arg0);
             },
             dispose: function(target) {
               bytecoder.referenceTable[target].stop();
             },
             setLoopingBOOLEAN: function(target,arg0) {
               bytecoder.referenceTable[target].loop=arg0;
             },
             setVolumeFLOAT: function(target,arg0) {
               bytecoder.referenceTable[target].volume=arg0;
             },
             play: function(target) {
               bytecoder.referenceTable[target].play();
             },
         },
         htmldivelement: {
             styleString: function(target,arg0) {
               bytecoder.referenceTable[target].style=bytecoder.toJSString(arg0);
             },
         },
         canvasrenderingcontext2d: {
             setGlobalCompositeOperationString: function(target,arg0) {
               bytecoder.referenceTable[target].globalCompositeOperation=bytecoder.toJSString(arg0);
             },
             drawImageCanvasImageSourceINTINT: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].drawImage(bytecoder.toJSReference(arg0),arg1,arg2);
             },
             setFillStyleString: function(target,arg0) {
               bytecoder.referenceTable[target].fillStyle=bytecoder.toJSString(arg0);
             },
             setStrokeStyleString: function(target,arg0) {
               bytecoder.referenceTable[target].strokeStyle=bytecoder.toJSString(arg0);
             },
             beginPath: function(target) {
               bytecoder.referenceTable[target].beginPath();
             },
             rectINTINTINTINT: function(target,arg0,arg1,arg2,arg3) {
               bytecoder.referenceTable[target].rect(arg0,arg1,arg2,arg3);
             },
             fill: function(target) {
               bytecoder.referenceTable[target].fill();
             },
             stroke: function(target) {
               bytecoder.referenceTable[target].stroke();
             },
             closePath: function(target) {
               bytecoder.referenceTable[target].closePath();
             },
             drawImageCanvasImageSourceINTINTINTINTINTINTINTINT: function(target,arg0,arg1,arg2,arg3,arg4,arg5,arg6,arg7,arg8) {
               bytecoder.referenceTable[target].drawImage(bytecoder.toJSReference(arg0),arg1,arg2,arg3,arg4,arg5,arg6,arg7,arg8);
             },
         },
         webglrenderingcontext: {
             createBuffer: function(target) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].createBuffer());
             },
             bindBufferINTWebGLBuffer: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].bindBuffer(arg0,bytecoder.toJSReference(arg1));
             },
             bufferDataINTFloatArrayINT: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].bufferData(arg0,bytecoder.toJSReference(arg1),arg2);
             },
             bufferDataINTInt16ArrayINT: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].bufferData(arg0,bytecoder.toJSReference(arg1),arg2);
             },
             createShaderINT: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].createShader(arg0));
             },
             shaderSourceWebGLShaderString: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].shaderSource(bytecoder.toJSReference(arg0),bytecoder.toJSString(arg1));
             },
             compileShaderWebGLShader: function(target,arg0) {
               bytecoder.referenceTable[target].compileShader(bytecoder.toJSReference(arg0));
             },
             getShaderParameterBooleanWebGLShaderINT: function(target,arg0,arg1) {
               return bytecoder.referenceTable[target].getShaderParameter(bytecoder.toJSReference(arg0),arg1);
             },
             getShaderParameteriWebGLShaderINT: function(target,arg0,arg1) {
               return bytecoder.referenceTable[target].getShaderParameteri(bytecoder.toJSReference(arg0),arg1);
             },
             getShaderInfoLogWebGLShader: function(target,arg0) {
               return bytecoder.toBytecoderString(bytecoder.referenceTable[target].getShaderInfoLog(bytecoder.toJSReference(arg0)));
             },
             createProgram: function(target) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].createProgram());
             },
             attachShaderWebGLProgramWebGLShader: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].attachShader(bytecoder.toJSReference(arg0),bytecoder.toJSReference(arg1));
             },
             linkProgramWebGLProgram: function(target,arg0) {
               bytecoder.referenceTable[target].linkProgram(bytecoder.toJSReference(arg0));
             },
             getProgramParameterBooleanWebGLProgramINT: function(target,arg0,arg1) {
               return bytecoder.referenceTable[target].getProgramParameter(bytecoder.toJSReference(arg0),arg1);
             },
             getProgramParameterIntWebGLProgramINT: function(target,arg0,arg1) {
               return bytecoder.referenceTable[target].getProgramParameter(bytecoder.toJSReference(arg0),arg1);
             },
             getProgramInfoLogWebGLProgram: function(target,arg0) {
               return bytecoder.toBytecoderString(bytecoder.referenceTable[target].getProgramInfoLog(bytecoder.toJSReference(arg0)));
             },
             getActiveAttribWebGLProgramINT: function(target,arg0,arg1) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].getActiveAttrib(bytecoder.toJSReference(arg0),arg1));
             },
             getAttribLocationWebGLProgramString: function(target,arg0,arg1) {
               return bytecoder.referenceTable[target].getAttribLocation(bytecoder.toJSReference(arg0),bytecoder.toJSString(arg1));
             },
             getActiveUniformWebGLProgramINT: function(target,arg0,arg1) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].getActiveUniform(bytecoder.toJSReference(arg0),arg1));
             },
             getUniformLocationWebGLProgramString: function(target,arg0,arg1) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].getUniformLocation(bytecoder.toJSReference(arg0),bytecoder.toJSString(arg1)));
             },
             createTexture: function(target) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].createTexture());
             },
             bindTextureINTWebGLTexture: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].bindTexture(arg0,bytecoder.toJSReference(arg1));
             },
             pixelStoreiINTINT: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].pixelStorei(arg0,arg1);
             },
             texImage2DINTINTINTINTINTINTINTINTInt8Array: function(target,arg0,arg1,arg2,arg3,arg4,arg5,arg6,arg7,arg8) {
               bytecoder.referenceTable[target].texImage2D(arg0,arg1,arg2,arg3,arg4,arg5,arg6,arg7,bytecoder.toJSReference(arg8));
             },
             texImage2DINTINTINTINTINTHtmlImageElement: function(target,arg0,arg1,arg2,arg3,arg4,arg5) {
               bytecoder.referenceTable[target].texImage2D(arg0,arg1,arg2,arg3,arg4,bytecoder.toJSReference(arg5));
             },
             generateMipmapINT: function(target,arg0) {
               bytecoder.referenceTable[target].generateMipmap(arg0);
             },
             texParameterfINTINTFLOAT: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].texParameterf(arg0,arg1,arg2);
             },
             getParameterfINT: function(target,arg0) {
               return bytecoder.referenceTable[target].getParameter(arg0);
             },
             useProgramWebGLProgram: function(target,arg0) {
               bytecoder.referenceTable[target].useProgram(bytecoder.toJSReference(arg0));
             },
             deleteShaderWebGLShader: function(target,arg0) {
               bytecoder.referenceTable[target].deleteShader(bytecoder.toJSReference(arg0));
             },
             deleteProgramWebGLProgram: function(target,arg0) {
               bytecoder.referenceTable[target].deleteProgram(bytecoder.toJSReference(arg0));
             },
             deleteTextureWebGLTexture: function(target,arg0) {
               bytecoder.referenceTable[target].deleteTexture(bytecoder.toJSReference(arg0));
             },
             deleteBufferWebGLBuffer: function(target,arg0) {
               bytecoder.referenceTable[target].deleteBuffer(bytecoder.toJSReference(arg0));
             },
             bufferSubDataINTINTFloatArray: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].bufferSubData(arg0,arg1,bytecoder.toJSReference(arg2));
             },
             bufferSubDataINTINTInt16Array: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].bufferSubData(arg0,arg1,bytecoder.toJSReference(arg2));
             },
             viewportINTINTINTINT: function(target,arg0,arg1,arg2,arg3) {
               bytecoder.referenceTable[target].viewport(arg0,arg1,arg2,arg3);
             },
             clearColorFLOATFLOATFLOATFLOAT: function(target,arg0,arg1,arg2,arg3) {
               bytecoder.referenceTable[target].clearColor(arg0,arg1,arg2,arg3);
             },
             clearINT: function(target,arg0) {
               bytecoder.referenceTable[target].clear(arg0);
             },
             depthMaskBOOLEAN: function(target,arg0) {
               bytecoder.referenceTable[target].depthMask(arg0);
             },
             uniformMatrix4fvWebGLUniformLocationBOOLEANFloatArray: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].uniformMatrix4fv(bytecoder.toJSReference(arg0),arg1,bytecoder.toJSReference(arg2));
             },
             uniform1iWebGLUniformLocationINT: function(target,arg0,arg1) {
               bytecoder.referenceTable[target].uniform1i(bytecoder.toJSReference(arg0),arg1);
             },
             disableINT: function(target,arg0) {
               bytecoder.referenceTable[target].disable(arg0);
             },
             enableINT: function(target,arg0) {
               bytecoder.referenceTable[target].enable(arg0);
             },
             blendFuncSeparateINTINTINTINT: function(target,arg0,arg1,arg2,arg3) {
               bytecoder.referenceTable[target].blendFuncSeparate(arg0,arg1,arg2,arg3);
             },
             drawElementsINTINTINTINT: function(target,arg0,arg1,arg2,arg3) {
               bytecoder.referenceTable[target].drawElements(arg0,arg1,arg2,arg3);
             },
             drawArraysINTINTINT: function(target,arg0,arg1,arg2) {
               bytecoder.referenceTable[target].drawArrays(arg0,arg1,arg2);
             },
             enableVertexAttribArrayINT: function(target,arg0) {
               bytecoder.referenceTable[target].enableVertexAttribArray(arg0);
             },
             vertexAttribPointerINTINTINTBOOLEANINTINT: function(target,arg0,arg1,arg2,arg3,arg4,arg5) {
               bytecoder.referenceTable[target].vertexAttribPointer(arg0,arg1,arg2,arg3,arg4,arg5);
             },
             disableVertexAttribArrayINT: function(target,arg0) {
               bytecoder.referenceTable[target].disableVertexAttribArray(arg0);
             },
         },
         htmlwebglcanvaselement: {
             getContextString: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].getContext(bytecoder.toJSString(arg0)));
             },
             width: function(target) {
               return bytecoder.referenceTable[target].width;
             },
             height: function(target) {
               return bytecoder.referenceTable[target].height;
             },
         },
         webglactiveinfo: {
             getSize: function(target) {
               return bytecoder.referenceTable[target].size;
             },
             getType: function(target) {
               return bytecoder.referenceTable[target].type;
             },
             getName: function(target) {
               return bytecoder.toBytecoderString(bytecoder.referenceTable[target].name);
             },
         },
         int16array: {
             setShortINTINT: function(target,arg0,arg1) {
               bytecoder.referenceTable[target][arg0]=arg1;
             },
         },
         parentnode: {
             getElementByIdString: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].getElementById(bytecoder.toJSString(arg0)));
             },
             querySelectorString: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].querySelector(bytecoder.toJSString(arg0)));
             },
         },
         extwindow: {
             getDevicePixelRatio: function(target) {
               return bytecoder.referenceTable[target].devicePixelRatio;
             },
         },
         htmlimageelement: {
             setCrossOriginString: function(target,arg0) {
               bytecoder.referenceTable[target].crossOrigin=bytecoder.toJSString(arg0);
             },
             setSrcString: function(target,arg0) {
               bytecoder.referenceTable[target].src=bytecoder.toJSString(arg0);
             },
             getWidth: function(target) {
               return bytecoder.referenceTable[target].width;
             },
             getHeight: function(target) {
               return bytecoder.referenceTable[target].height;
             },
         },
         window: {
             document: function(target) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].document);
             },
             requestAnimationFrameAnimationFrameCallback: function(target,arg0) {
               bytecoder.referenceTable[target].requestAnimationFrame(bytecoder.registerCallback(arg0,function (farg0) {var marg0=farg0;bytecoder.exports.dmbawAnimationFrameCallback_VOIDrunINT(arg0,marg0);}));
             },
         },
         windoworworkerglobalscope: {
             fetchString: function(target,arg0) {
               return bytecoder.toBytecoderReference(bytecoder.referenceTable[target].fetch(bytecoder.toJSString(arg0)));
             },
         },
     },
};
