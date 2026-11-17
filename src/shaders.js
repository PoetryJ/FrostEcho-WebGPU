// The shared fog, reverse depth and HDR composition follow Abyssal Garden's architecture.
// Snow materials, height fog, local warm lighting and particle motion are adapted for land.
export const GLOBAL = /* wgsl */ `
struct Globals {
  vp:mat4x4f, shadow:mat4x4f,
  cam:vec4f, right:vec4f, up:vec4f, forward:vec4f,
  sun:vec4f, light:vec4f, skyLow:vec4f, skyHigh:vec4f,
  fog:vec4f, params:vec4f, res:vec4f, hero:vec4f,
  lights:array<vec4f,32>
};
@group(0) @binding(0) var<uniform> g:Globals;
fn sat(x:f32)->f32{return clamp(x,0.,1.);}
fn hash(p:vec3f)->f32{var q=fract(p*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
fn noise(p:vec3f)->f32{
 let i=floor(p);let f=fract(p);let u=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3f(1,0,0)),u.x),mix(hash(i+vec3f(0,1,0)),hash(i+vec3f(1,1,0)),u.x),u.y),mix(mix(hash(i+vec3f(0,0,1)),hash(i+vec3f(1,0,1)),u.x),mix(hash(i+vec3f(0,1,1)),hash(i+vec3f(1,1,1)),u.x),u.y),u.z);
}
fn sky(rd:vec3f)->vec3f{
 let h=sat(rd.y*.8+.2);var c=mix(g.skyLow.rgb,g.skyHigh.rgb,h);
 let clouds=noise(rd*6.+vec3f(g.cam.w*.008,0,0));c*=.85+.30*clouds;
 let sun=pow(sat(dot(rd,g.sun.xyz)),64.);c+=g.light.rgb*sun*.20;
 return c;
}
fn fogIntegral(y:f32,dy:f32,d:f32)->f32{
 let a=.055*dy;
 let I=select((1.-exp(clamp(-a*d,-25.,25.)))/select(a,1e-5,abs(a)<1e-5),d,abs(a)<1e-5);
 return exp(-.055*y)*max(I,0.);
}
// The same medium applies to all surfaces, but the enclosed hero cabin contains no outdoor snow fog.
fn fog(c:vec3f,p:vec3f)->vec3f{
 let v=p-g.cam.xyz;let d=max(length(v),.001);let rd=v/d;
 var integral=fogIntegral(g.cam.y,rd.y,d);
 let lo=vec3f(g.hero.x-g.hero.z,.30,g.hero.y-g.hero.w);
 let hi=vec3f(g.hero.x+g.hero.z,3.35,g.hero.y+g.hero.w);
 let safe=select(rd,vec3f(1e-5),abs(rd)<vec3f(1e-5));
 let a=(lo-g.cam.xyz)/safe;let b=(hi-g.cam.xyz)/safe;let near=min(a,b);let far=max(a,b);
 let enter=max(0.,max(near.x,max(near.y,near.z)));let leave=min(d,min(far.x,min(far.y,far.z)));
 if(leave>enter){integral-=fogIntegral(g.cam.y+rd.y*enter,rd.y,leave-enter);}
 let optical=g.fog.w*max(integral,0.);
 let T=exp(-min(optical,30.));let tint=mix(g.fog.rgb,g.skyLow.rgb,sat(rd.y*.6));
 return c*T+tint*(1.-T);
}
`;

const VERTEX = /* wgsl */ `
struct VI{@location(0) p:vec3f,@location(1) n:vec4f,@location(2) a:vec4f,@location(3) b:vec4f,@location(4) c:vec4f,@location(5) d:vec4f};
struct VO{@builtin(position) cp:vec4f,@location(0) wp:vec3f,@location(1) n:vec3f,@location(2) op:vec3f,@location(3) @interpolate(flat) color:vec4f,@location(4) @interpolate(flat) material:vec4f};
fn rotate(v:vec3f,a:f32)->vec3f{let c=cos(a);let s=sin(a);return vec3f(c*v.x+s*v.z,v.y,-s*v.x+c*v.z);}
fn world(i:VI)->vec3f{
 var p=rotate(i.p*i.b.xyz,i.a.w)+i.a.xyz;
 if(i.d.x>5.5&&i.d.x<6.5){let sway=sin(g.cam.w*.5+i.a.x*.1+i.a.z*.07)*g.params.y*.10;p.x+=sway*max(i.p.y,0.);}
 return p;
}
@vertex fn vs(i:VI)->VO{var o:VO;let p=world(i);o.cp=g.vp*vec4f(p,1.);o.wp=p;o.n=rotate(i.n.xyz/max(i.b.xyz,vec3f(.001)),i.a.w);o.op=i.p;o.color=i.c;o.material=i.d;return o;}
@vertex fn vsShadow(i:VI)->@builtin(position) vec4f{return g.shadow*vec4f(world(i),1.);}
`;

export const SOLID =
  GLOBAL +
  VERTEX +
  /* wgsl */ `
@group(0) @binding(1) var shadowMap:texture_depth_2d;
@group(0) @binding(2) var shadowSampler:sampler_comparison;
fn shadow(p:vec3f,n:vec3f)->f32{
 let q=g.shadow*vec4f(p+n*.06,1.);let uv=vec2f(q.x*.5+.5,.5-q.y*.5);
 if(any(uv<vec2f(0.))||any(uv>vec2f(1.))){return 1.;}
 var a=0.;let e=1./2048.;
 for(var x=0;x<2;x++){for(var y=0;y<2;y++){a+=textureSampleCompareLevel(shadowMap,shadowSampler,uv+(vec2f(f32(x),f32(y))-.5)*e*2.,q.z-.0015);}}
 return a*.25;
}
@fragment fn fs(i:VO,@builtin(front_facing) front:bool)->@location(0) vec4f{
 var n=normalize(i.n)*select(-1.,1.,front);let V=normalize(g.cam.xyz-i.wp);let mat=i.material.x;
 let detail=noise(i.wp*2.7);let broad=noise(i.wp*.26);
 var albedo=i.color.rgb;var rough=.8;
 if(mat>0.5&&mat<1.5){
   albedo*=.86+.22*detail;
   let dx=noise(i.wp*4.+vec3f(.13,0,0))-detail;let dz=noise(i.wp*4.+vec3f(0,0,.13))-detail;
   n=normalize(n+vec3f(dx,0,dz)*.23);
   rough=.55;
 }else if(mat>1.5&&mat<2.5){
   let grain=noise(i.wp*vec3f(.22,12.,.4));albedo*=.65+.7*grain;rough=.82;
 }else if(mat>2.5&&mat<3.5){albedo*=.65+.55*broad+.2*detail;}
 else if(mat>3.5&&mat<4.5){rough=.34;}
 else if(mat>5.5&&mat<6.5){albedo*=.65+.5*detail;}
 else if(mat>6.5){albedo*=.94+.12*detail;}
 let sunlit=shadow(i.wp,n);
 let ndl=sat(dot(n,g.sun.xyz));
 let skyAmbient=mix(g.skyLow.rgb,g.skyHigh.rgb,sat(n.y*.5+.5))*(.35+.65*sat(n.y*.5+.5));
 var c=albedo*(skyAmbient*.85+g.light.rgb*ndl*sunlit);
 let H=normalize(V+g.sun.xyz);let spec=pow(sat(dot(n,H)),mix(64.,8.,rough))*sunlit;
 c+=g.light.rgb*spec*.12;
 // Snow's broad forward scattering is an artistic approximation, not a full BSSRDF.
 if(mat>0.5&&mat<1.5){c+=albedo*g.light.rgb*pow(sat(dot(-V,g.sun.xyz)),4.)*.045;}
 for(var k=0u;k<32u;k++){
   let l=g.lights[k];if(l.w==0.){break;}
   let v=l.xyz-i.wp;let d2=dot(v,v);
   if(d2<49.){let dist=max(sqrt(d2),.01);let fall=pow(sat(1.-dist/7.),2.);
     c+=albedo*vec3f(1.,.35,.065)*(l.w*fall/(1.+d2*.3))*(.25+.75*sat(dot(n,v/dist)));}
 }
 c+=i.color.rgb*i.color.a*(.94+.06*sin(g.cam.w*1.7+i.wp.x));
 // Local interior fill is bounded to this cabin's footprint; it never changes simulation state.
 let inside=step(abs(i.wp.x-g.hero.x),g.hero.z)*step(abs(i.wp.z-g.hero.y),g.hero.w)*step(i.wp.y,3.25);
 c+=albedo*vec3f(.65,.24,.07)*inside*.55;
 return vec4f(fog(c,i.wp),1.);
}
`;

export const SKY =
  GLOBAL +
  /* wgsl */ `
struct O{@builtin(position) p:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->O{var o:O;let p=vec2f(f32(i32(i&1u)*4-1),f32(i32(i>>1u)*4-1));o.p=vec4f(p,0.,1.);o.uv=p;return o;}
@fragment fn fs(i:O)->@location(0) vec4f{let rd=normalize(g.forward.xyz+g.right.xyz*i.uv.x*g.right.w+g.up.xyz*i.uv.y*g.up.w);return vec4f(sky(rd),1.);}
`;

export const PARTICLES =
  GLOBAL +
  /* wgsl */ `
struct O{@builtin(position) p:vec4f,@location(0) uv:vec2f,@location(1) color:vec4f};
@vertex fn vs(@builtin(vertex_index) vi:u32,@location(0) seed:vec4f)->O{
 var o:O;let q=vec2f(f32(vi&1u),f32(vi>>1u))*2.-1.;let t=g.cam.w;let storm=g.params.y;
 let B=58.;let speed=mix(.8,6.,storm);let drift=vec3f(t*speed,-t*(.65+seed.w*1.4),t*speed*.27);
 var p=g.cam.xyz+(fract((seed.xyz*B+drift-g.cam.xyz)/B+.5)-.5)*B;
 p.x+=sin(t*.8+seed.y*60.)*(.3+storm*.8);p.z+=cos(t*.6+seed.x*50.)*.3;
 let d=length(p-g.cam.xyz);let size=(.014+.045*seed.w*seed.w)*mix(1.,.7,g.params.z);
 let stretch=1.+storm*2.5;
 let w=p+g.right.xyz*q.x*size+g.up.xyz*q.y*size*stretch;
 o.p=g.vp*vec4f(w,1.);o.uv=q;
 let fade=smoothstep(.5,2.5,d)*(1.-smoothstep(B*.33,B*.49,d))*smoothstep(-.1,.5,p.y);
 let indoor=step(abs(p.x-g.hero.x),g.hero.z)*step(abs(p.z-g.hero.y),g.hero.w)*step(p.y,6.);
 let alpha=fade*(1.-indoor)*(.27+storm*.5)*exp(-d*g.fog.w);
 let warm=pow(sat(1.-distance(p,vec3f(g.hero.x,2.,g.hero.y+g.hero.w))/9.),2.);
 o.color=vec4f(mix(g.skyLow.rgb*1.25,vec3f(1.,.55,.2),warm*.75),alpha);
 if(seed.w>mix(.13,1.,storm)){o.p=vec4f(0.,0.,2.,1.);}
 return o;
}
@fragment fn fs(i:O)->@location(0) vec4f{let a=i.color.a*exp(-dot(i.uv,i.uv)*2.8);return vec4f(i.color.rgb*a,a);}
`;

const FULLSCREEN = /* wgsl */ `
struct O{@builtin(position) p:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->O{var o:O;let p=vec2f(f32(i32(i&1u)*4-1),f32(i32(i>>1u)*4-1));o.p=vec4f(p,0.,1.);o.uv=vec2f(p.x*.5+.5,.5-p.y*.5);return o;}
`;
// Six-level bloom pyramid, with source-style first-downsample firefly suppression.
export const BLOOM =
  FULLSCREEN +
  /* wgsl */ `
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var samp:sampler;
fn blur(uv:vec2f)->vec3f{let e=1./vec2f(textureDimensions(source));return (textureSample(source,samp,uv+e*vec2f(-.6,-.6)).rgb+textureSample(source,samp,uv+e*vec2f(.6,-.6)).rgb+textureSample(source,samp,uv+e*vec2f(-.6,.6)).rgb+textureSample(source,samp,uv+e*vec2f(.6,.6)).rgb)*.25;}
@fragment fn down(i:O)->@location(0) vec4f{return vec4f(blur(i.uv),1.);}
@fragment fn bright(i:O)->@location(0) vec4f{let c=blur(i.uv);let b=max(c.r,max(c.g,c.b));return vec4f(c*smoothstep(.65,2.,b),1.);}
`;
export const POST =
  GLOBAL +
  FULLSCREEN +
  /* wgsl */ `
@group(0) @binding(1) var scene:texture_2d<f32>;
@group(0) @binding(2) var bloom:texture_2d<f32>;
@group(0) @binding(3) var samp:sampler;
fn tone(x:vec3f)->vec3f{return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),vec3f(0.),vec3f(1.));}
@fragment fn fs(i:O)->@location(0) vec4f{
 var c=textureSample(scene,samp,i.uv).rgb+textureSample(bloom,samp,i.uv).rgb*.18;
 c*=g.params.w;let q=i.uv-.5;c*=1.-dot(q,q)*.42;
 c=tone(c);c=pow(c,vec3f(1./2.2));
 let grain=fract(52.9829189*fract(dot(i.p.xy,vec2f(.06711056,.00583715))))-.5;
 return vec4f(c+grain/255.,1.);
}
`;
