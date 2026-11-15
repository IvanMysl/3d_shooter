
function createWorldMesh(level){
  worldDecorClearance=false;
  resetWorldSolids();
  if(!glReady)return;
  let t=themes[sectorStyle%themes.length],v=[],size=mapSize;
  if(worldMesh){gl.deleteBuffer(worldMesh.b);worldMesh=null;}for(const c of worldChunks)gl.deleteBuffer(c.mesh.b);worldChunks=[];meshStats={chunks:0,triangles:0};
  const detail=save.settings.quality!==0, roofH=ceilingHeight();
  const metal=rcolor(t.wall,.49),trim=rcolor(t.wall,1.48),dim=rcolor(t.accent,.46),bright=rcolor(t.accent,.93);
  for(let z0=1;z0<size-1;z0+=9)for(let x0=1;x0<size-1;x0+=9){
  let v=[];
  for(let z=z0;z<Math.min(z0+9,size-1);z++)for(let x=x0;x<Math.min(x0+9,size-1);x++){
    let open=mapCells[z][x]===0;
    if(open){
      let seed=(x*31+z*17+level*7),base=rcolor(t.floor,.72+(seed%9)*.035);
      quad(v,[x,0,z+1],[x+1,0,z+1],[x+1,0,z],[x,0,z],[0,1,0],base);
      // Actual elevated stairs: opaque tread planes, vertical risers and
      // metal nosing, matching exactly the physics height map.
      const stepY=floorHeightAtCell(x,z);
      if(stepY>.001){
        const tread=rcolor(t.floor,.88+(seed%5)*.045);
        const riser=rcolor(t.wall,.42);
        const accent=rcolor(t.accent,.56);
        quad(v,[x,stepY,z+1],[x+1,stepY,z+1],[x+1,stepY,z],[x,stepY,z],[0,1,0],tread);
        const n=floorHeightAtCell(x,z-1),s=floorHeightAtCell(x,z+1),e=floorHeightAtCell(x+1,z),w=floorHeightAtCell(x-1,z);
        if(n<stepY-.01){quad(v,[x,stepY,z],[x+1,stepY,z],[x+1,n,z],[x,n,z],[0,0,-1],riser);}
        if(s<stepY-.01){quad(v,[x+1,stepY,z+1],[x,stepY,z+1],[x,s,z+1],[x+1,s,z+1],[0,0,1],riser);}
        if(e<stepY-.01){quad(v,[x+1,stepY,z],[x+1,stepY,z+1],[x+1,e,z+1],[x+1,e,z],[1,0,0],riser);}
        if(w<stepY-.01){quad(v,[x,stepY,z+1],[x,stepY,z],[x,w,z],[x,w,z+1],[-1,0,0],riser);}
        // Brushed anti-slip treads are paint-thin walkable surface details.
        // Keep them visible, but never register them as collision boxes:
        // a player approaches a riser with feet on the LOWER tread, so the
        // old raised solid strip snagged the body's leading edge before the
        // centre could reach the next floor-height cell.
        if(detail&&(n<stepY-.01||s<stepY-.01)){
          box(v,x+.12,stepY+.003,z+.10,x+.88,stepY+.013,z+.13,accent,.30,[0,0,0,0,1,0]);
          for(let k=0;k<3;k++)box(v,x+.25+k*.17,stepY+.004,z+.3,x+.28+k*.17,stepY+.012,z+.72,rcolor(t.wall,1.30),0,[0,0,0,0,1,0]);
        }
        if(detail&&e<stepY-.01)box(v,x+.86,stepY+.003,z+.14,x+.90,stepY+.014,z+.86,accent,.28,[0,0,0,0,1,0]);
      }
      // HIGH DECK: real suspended bridge, with underside, braces and railings.
      // Unlike a raised height-map tile this leaves a walkable lower passage.
      const deckY=deckAtCell(x,z);
      if(deckY>0){
        const plate=rcolor(t.floor,.69),frame=rcolor(t.wall,1.35),rail=rcolor(t.wall,1.55),a=rcolor(t.accent,.62);
        worldSolidBox(v,x,deckY-.17,z,x+1,deckY,z+1,plate,0);
        if(detail){
          worldSolidBox(v,x+.06,deckY+.008,z+.09,x+.94,deckY+.019,z+.13,a,.47,[0,0,0,0,1,0]);
          for(let k=0;k<4;k++){let zz=z+.2+k*.19;worldSolidBox(v,x+.12,deckY+.010,zz,x+.88,deckY+.017,zz+.025,frame,0,[0,0,0,0,1,0]);}
        }
        for(const side of [-1,1]){
          const zz=side<0?z:z+1;
          if(deckAtCell(x,z+side)===0){
            worldSolidBox(v,x,deckY-.20,zz-.04,x+1,deckY+.015,zz+.04,frame,0);
            // A safety rail must exist at EVERY quality setting: otherwise
            // low graphics settings alter collision and leave upper decks open.
            worldSolidBox(v,x+.08,deckY+.64,zz-.028,x+.92,deckY+.70,zz+.028,rail,0);
            if(detail){
              worldSolidBox(v,x+.08,deckY+.28,zz-.024,x+.92,deckY+.33,zz+.024,rail,0);
              if(x%2===0)worldSolidBox(v,x+.10,deckY+.02,zz-.032,x+.15,deckY+.74,zz+.032,rail,0);
            }
          }
        }
        // Structural supports stay at the outer edges of the underpass.
        if((x%4===0)&&((z+1)%4===0)&&deckAtCell(x,z-1)===0){
          worldSolidBox(v,x+.04,0,z+.08,x+.20,deckY-.17,z+.26,frame,0);
          if(detail)worldSolidBox(v,x+.02,.20,z+.065,x+.23,.27,z+.28,a,.21);
        }
      }
      if((x+z+level*3)%11===0){
        worldSolidBox(v,x+.035,.006,z+.05,x+.055,.012,z+.95,dim,.28,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.05,.006,z+.035,x+.95,.012,z+.055,dim,.28,[0,0,0,0,1,0]);
      }
      if(detail&&seed%11===0)buildFloorDecal(v,x,z,t,seed);
      // VANGUARD SET DRESSING: physically modeled infrastructure in static
      // chunks. Ceiling-mounted hardware stays out of the navigation grid.
      if(detail && sectorStyle<14 && (!touchOnly||save.settings.quality===2||seed%3===0) && (seed%41===9 || seed%53===11)){
        const alloy=rcolor(t.wall,.58),sil=[.055,.067,.073],chrome=rcolor(t.wall,1.42);
        const warm=[.95,.61,.22],light=rcolor(t.accent,1.3);
        const cX=x+.5,cZ=z+.5;
        // Suspended power service cassette with four brackets and vents.
        worldSolidBox(v,x+.16,3.64,z+.18,x+.84,3.85,z+.82,alloy,0);
        worldSolidBox(v,x+.22,3.61,z+.25,x+.78,3.64,z+.75,sil,0);
        for(let a=0;a<6;a++)worldSolidBox(v,x+.26+a*.075,3.598,z+.29,x+.29+a*.075,3.605,z+.72,chrome,0,[0,0,0,0,1,0]);
        for(const ix of [x+.23,x+.77])for(const iz of [z+.26,z+.74])worldSolidBox(v,ix-.028,3.76,iz-.028,ix+.028,4.2,iz+.028,chrome,0);
        worldSolidBox(v,x+.38,3.586,z+.38,x+.62,3.598,z+.62,light,1.15,[0,0,0,0,1,0]);
        if((seed%3)===0){
          for(const iz of [z+.22,z+.77])worldSolidBox(v,x+.14,3.51,iz-.021,x+.86,3.57,iz+.021,chrome,0);
        }
      }
      if(detail && sectorStyle<14 && (!touchOnly||save.settings.quality===2||seed%3===0) && seed%59===13){
        // Overhead cable bridge and hanging structural lock brackets.
        const dark=rcolor(t.wall,.36),pale=rcolor(t.wall,1.52),alert=[.61,.32,.11];
        worldSolidBox(v,x+.02,3.39,z+.10,x+.98,3.48,z+.18,dark,0);
        worldSolidBox(v,x+.02,3.39,z+.82,x+.98,3.48,z+.90,dark,0);
        for(let j=0;j<4;j++){
          const xx=x+.12+j*.23;
          worldSolidBox(v,xx,3.37,z+.12,xx+.075,3.42,z+.88,pale,0);
          worldSolidBox(v,xx+.014,3.422,z+.22,xx+.059,3.435,z+.78,j===0?alert:dark,0);
        }
        for(const iz of [z+.14,z+.86])for(const ix of [x+.06,x+.93])worldSolidBox(v,ix-.02,3.44,iz-.018,ix+.02,4.21,iz+.018,pale,0);
      }
      if(detail && (!touchOnly||save.settings.quality===2||seed%3===0) && seed%73===7){
        // Removable floor engineering plate with bolted corners and steel seam.
        const base=rcolor(t.floor,.47),edge=rcolor(t.wall,1.75),rubber=[.048,.06,.073];
        worldSolidBox(v,x+.11,.018,z+.12,x+.89,.038,z+.88,edge,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.14,.040,z+.15,x+.86,.047,z+.85,base,0,[0,0,0,0,1,0]);
        for(const ix of [x+.18,x+.82])for(const iz of [z+.19,z+.81])worldSolidBox(v,ix-.024,.049,iz-.024,ix+.024,.054,iz+.024,rubber,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.47,.05,z+.23,x+.53,.056,z+.77,rubber,0,[0,0,0,0,1,0]);
      }

      if(detail&&(seed%41===0)&&mapCells[z][x]===0){
        // Thin raised maintenance lane marks and numbered tread lugs.
        const hazard=[.52,.29,.095],rubber=[.055,.069,.073];
        worldSolidBox(v,x+.13,.016,z+.11,x+.87,.021,z+.19,rubber,0,[0,0,0,0,1,0]);
        for(let q=0;q<5;q++){
          const xx=x+.15+q*.14;
          worldSolidBox(v,xx,.023,z+.12,xx+.065,.027,z+.18,hazard,0,[0,0,0,0,1,0]);
        }
      }
      if(detail&&seed%13===0){
        // Inset grated service drains, alloy lip, three individual slots.
        const steel=rcolor(t.wall,1.3),pit=rcolor(t.floor,.24);
        worldSolidBox(v,x+.18,.012,z+.20,x+.82,.018,z+.80,steel,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.23,.02,z+.25,x+.77,.026,z+.75,pit,0,[0,0,0,0,1,0]);
        for(let j=0;j<4;j++)worldSolidBox(v,x+.26+j*.125,.027,z+.26,x+.278+j*.125,.032,z+.74,steel,0,[0,0,0,0,1,0]);
      }
      if(detail&&seed%23===0){
        // Small floor access hatch with bolts, no collision height.
        const plate=rcolor(t.wall,.78),rim=rcolor(t.wall,1.5);
        worldSolidBox(v,x+.17,.012,z+.16,x+.83,.018,z+.84,plate,0,[0,0,0,0,1,0]);
        for(let dx of [.22,.77])for(let dz of [.21,.79])worldSolidBox(v,x+dx-.025,.019,z+dz-.025,x+dx+.025,.023,z+dz+.025,rim,0,[0,0,0,0,1,0]);
      }
      if((sectorStyle===3||sectorStyle===1)&&seed%23===0){
        worldSolidBox(v,x+.17,.023,z+.16,x+.82,.028,z+.19,bright,1.0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.17,.023,z+.78,x+.82,.028,z+.81,dim,.8,[0,0,0,0,1,0]);
      }
      if(seed%19===0){
        worldSolidBox(v,x+.24,.023,z+.28,x+.76,.026,z+.73,rcolor(t.floor,1.65),0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.4,.028,z+.44,x+.6,.034,z+.56,bright,.7,[0,0,0,0,1,0]);
      }
      let adj=0;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(mapCells[z+dz]?.[x+dx]===0)adj++;
      // Covered transit galleries alternate with open, monumental halls.
      if(((adj<=2) || seed%7!==0) && ((x*7+z*3+level)%13!==0)){
        quad(v,[x,roofH+.10,z],[x+1,roofH+.10,z],[x+1,roofH+.10,z+1],[x,roofH+.10,z+1],[0,-1,0],rcolor(t.wall,.43));
        registerWorldSolid(x,roofH+.09,z,x+1,roofH+.13,z+1,'ceiling');
        if(detail&&seed%9===0)worldSolidBox(v,x+.15,roofH+.07,z+.45,x+.85,roofH+.08,z+.55,bright,.78,[0,0,0,0,0,1]);
        if(detail&&seed%9===0){
          const frame=rcolor(t.wall,1.4),light=[.70,.74,.67];
          worldSolidBox(v,x+.12,roofH+.02,z+.10,x+.88,roofH+.06,z+.88,frame,0,[0,0,0,0,0,1]);
          worldSolidBox(v,x+.31,roofH-.01,z+.18,x+.69,roofH,z+.82,light,1.45,[0,0,0,0,0,1]);
        }
      }
    }else{
      const side=[!mapCells[z+1]?.[x],!mapCells[z-1]?.[x],!mapCells[z]?.[x-1],!mapCells[z]?.[x+1]];
      if(!side.some(Boolean))continue;
      let seed=x*11+z*19+level*13;
      let intensity=.71+(seed%7)*.040;
      worldSolidBox(v,x,0,z,x+1,roofH,z+1,rcolor(t.wall,intensity),0,[...side,1,0]);
      // Semi-recessed service wall: protective rails, actual cable raceways,
      // a vent grille, latches, and a caution marker. Static/batched geometry.
      if(detail&&seed%11===0){
        const ink=[.07,.085,.09],body=[.20,.235,.25],rim=[.37,.40,.40],
              ochre=[.70,.40,.13],glass=[.08,.22,.25],lamp=rcolor(t.accent,.62);
        const service=(axis,front)=>{
          // local x-axis is horizontal along a face, depth positive toward viewer
          const box2=(a,b,c,d,e,f,color,glow=0)=>{
            const cx=x+.5,cz=z+.5;
            if(axis==='z'){
              const q=front>0?z+1.07:z-.07;
              worldSolidBox(v,cx+a,b,Math.min(q+c*front,q+f*front),cx+d,e,Math.max(q+c*front,q+f*front),color,glow);
            }else{
              const q=front>0?x+1.07:x-.07;
              worldSolidBox(v,Math.min(q+c*front,q+f*front),b,cz+a,Math.max(q+c*front,q+f*front),e,cz+d,color,glow);
            }
          };
          // Face segments use a small symmetric depth range, requiring only a
          // fraction of a floor tile; invisible for collision purposes.
          box2(-.41,.45,-.033,.41,3.36,.035,ink);
          box2(-.37,.53,-.058,.37,3.23,.062,body);
          box2(-.39,.51,-.078,.39,.59,.080,rim);
          box2(-.39,3.15,-.078,.39,3.23,.080,rim);
          box2(-.31,1.36,-.082,.31,2.29,.084,ink);
          for(let k=0;k<7;k++)box2(-.27,1.48+k*.105,-.092,.27,1.52+k*.105,.096,rim);
          for(let k=0;k<3;k++)box2(-.33,2.59+k*.15,-.094,.33,2.65+k*.15,.095,k===2?ochre:ink,k===2?.12:0);
          box2(.27,.83,-.102,.34,1.09,.108,glass,.15);
          for(let k=0;k<2;k++){
            box2(-.33+k*.60,.64,-.100,-.29+k*.60,.72,.105,ochre,.1);
            box2(-.33+k*.60,2.99,-.105,-.29+k*.60,3.05,.108,lamp,.55);
          }
        };
        if(side[0])service('z',1);else if(side[1])service('z',-1);
        else if(side[2])service('x',-1);else if(side[3])service('x',1);
      }
      // Buttresses and double-height ribs create readable 3D architecture.
      if(side[0]&&seed%3!==0){
        worldSolidBox(v,x+.04,.09,z+.97,x+.22,3.93,z+1.035,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.78,.09,z+.97,x+.96,3.93,z+1.035,trim,0,[1,0,0,0,1,1]);
      }
      if(side[1]&&seed%3!==0){
        worldSolidBox(v,x+.04,.09,z-.035,x+.22,3.93,z+.03,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.78,.09,z-.035,x+.96,3.93,z+.03,trim,0,[1,0,0,0,1,1]);
      }
      if(side[2]&&seed%3!==0){
        worldSolidBox(v,x-.035,.09,z+.04,x+.03,3.93,z+.22,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x-.035,.09,z+.78,x+.03,3.93,z+.96,trim,0,[1,0,0,0,1,1]);
      }
      if(side[3]&&seed%3!==0){
        worldSolidBox(v,x+.97,.09,z+.04,x+1.035,3.93,z+.22,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.97,.09,z+.78,x+1.035,3.93,z+.96,trim,0,[1,0,0,0,1,1]);
      }
      // Three-layer industrial panels: fascia, illuminated seam and foot rail.
      const addFace=(axis,at,sideInt)=>{
        let x1=x+.1,x2=x+.9,z1=z+.1,z2=z+.9;
        if(axis==='z'){
          worldSolidBox(v,x1,.18,at-.023,x2,.37,at+.023,metal,0,[1,1,0,0,1,1]);
          worldSolidBox(v,x1,3.18,at-.022,x2,3.27,at+.022,dim,.52,[1,1,0,0,1,1]);
          worldSolidBox(v,x1,3.94,at-.02,x2,4.05,at+.02,trim,0,[1,1,0,0,1,1]);
          if(detail&&sideInt%5===0){worldSolidBox(v,x+.47,.8,at-.032,x+.53,2.62,at+.032,bright,1.15,[1,1,0,0,1,1]);}
          else if(detail&&sideInt%7===0)worldSolidBox(v,x+.22,1.4,at-.034,x+.78,1.47,at+.034,dim,.8,[1,1,0,0,1,1]);
        }else{
          worldSolidBox(v,at-.023,.18,z1,at+.023,.37,z2,metal,0,[0,0,1,1,1,1]);
          worldSolidBox(v,at-.022,3.18,z1,at+.022,3.27,z2,dim,.52,[0,0,1,1,1,1]);
          worldSolidBox(v,at-.02,3.94,z1,at+.02,4.05,z2,trim,0,[0,0,1,1,1,1]);
          if(detail&&sideInt%5===0)worldSolidBox(v,at-.032,.8,z+.47,at+.032,2.62,z+.53,bright,1.15,[0,0,1,1,1,1]);
          else if(detail&&sideInt%7===0)worldSolidBox(v,at-.034,1.4,z+.22,at+.034,1.47,z+.78,dim,.8,[0,0,1,1,1,1]);
        }
      };
      if(side[0])addFace('z',z+1.009,seed);
      if(side[1])addFace('z',z-.009,seed+3);
      if(side[2])addFace('x',x-.009,seed+7);
      if(side[3])addFace('x',x+1.009,seed+11);
      if(detail&&seed%6===0){
        // Recessed power conduit with two supporting metal clamp brackets.
        const pipe=rcolor(t.wall,1.9),cable=rcolor(t.wall,.32);
        if(side[0]||side[1]){
          const iz=side[0]?z+1.04:z-.04;
          worldSolidBox(v,x+.12,2.53,iz-.038,x+.88,2.61,iz+.038,pipe,0,[1,1,1,1,1,1]);
          for(const xx of [x+.22,x+.74])worldSolidBox(v,xx,2.46,iz-.05,xx+.07,2.69,iz+.05,cable,0);
        }else if(side[2]||side[3]){
          const ix=side[3]?x+1.04:x-.04;
          worldSolidBox(v,ix-.038,2.53,z+.12,ix+.038,2.61,z+.88,pipe,0);
          for(const zz of [z+.22,z+.74])worldSolidBox(v,ix-.05,2.46,zz,ix+.05,2.69,zz+.07,cable,0);
        }
      }
      // Architectural set dressing: wall-mounted breaker boxes, shock braces,
      // hanging cable runs and maintenance placards (pure geometry, no collision).
      if(detail && seed%7===0){
        const panel=rcolor(t.wall,.55),frame=rcolor(t.wall,1.12),dark=[.055,.067,.072],warm=[.87,.47,.15];
        const addCabinet=(axis,sideVal)=>{
          if(axis==='z'){
            const face=sideVal>0?z+1.07:z-.07;
            worldSolidBox(v,x+.24,1.08,face-.035,x+.76,2.32,face+.035,panel,0);
            worldSolidBox(v,x+.20,1.05,face-.055,x+.80,1.13,face+.055,frame,0);
            worldSolidBox(v,x+.25,2.26,face-.055,x+.75,2.32,face+.055,frame,0);
            worldSolidBox(v,x+.31,1.48,face-.063,x+.69,1.88,face+.063,dark,0);
            for(let k=0;k<4;k++)worldSolidBox(v,x+.34,1.54+k*.076,face-.074,x+.66,1.565+k*.076,face+.074,frame,0);
            worldSolidBox(v,x+.59,2.07,face-.075,x+.67,2.14,face+.075,warm,.55);
          }else{
            const face=sideVal>0?x+1.07:x-.07;
            worldSolidBox(v,face-.035,1.08,z+.24,face+.035,2.32,z+.76,panel,0);
            worldSolidBox(v,face-.055,1.05,z+.20,face+.055,1.13,z+.8,frame,0);
            worldSolidBox(v,face-.055,2.26,z+.25,face+.055,2.32,z+.75,frame,0);
            worldSolidBox(v,face-.065,1.48,z+.31,face+.065,1.88,z+.69,dark,0);
            for(let k=0;k<4;k++)worldSolidBox(v,face-.073,1.54+k*.076,z+.34,face+.073,1.565+k*.076,z+.66,frame,0);
            worldSolidBox(v,face-.075,2.07,z+.59,face+.075,2.14,z+.67,warm,.55);
          }
        };
        if(side[0])addCabinet('z',1);else if(side[1])addCabinet('z',-1);
        else if(side[2])addCabinet('x',-1);else if(side[3])addCabinet('x',1);
      }
      if(detail && seed%13===0){
       // Diagonal strengthening struts with tiered bracket and hanging conduit.
       const oxid=rcolor(t.wall,.67),highlight=rcolor(t.wall,1.45);
       if(side[0]||side[1]){
        const zz=side[0]?z+1.059:z-.059;
        for(let j=0;j<4;j++)worldSolidBox(v,x+.15+j*.17,.48+j*.55,zz-.027,x+.20+j*.17,.77+j*.55,zz+.027,oxid,0);
        worldSolidBox(v,x+.12,.44,zz-.064,x+.85,.51,zz+.064,highlight,0);
       }else if(side[2]||side[3]){
        const xx=side[3]?x+1.059:x-.059;
        for(let j=0;j<4;j++)worldSolidBox(v,xx-.027,.48+j*.55,z+.15+j*.17,xx+.027,.77+j*.55,z+.20+j*.17,oxid,0);
        worldSolidBox(v,xx-.064,.44,z+.12,xx+.064,.51,z+.85,highlight,0);
       }
      }
      // Microscale environment dressing: stencil strips, plate bolts, ID plaques,
      // access switches, hose clamps. Grouped in static world chunks, not draw calls.
      if(detail && seed%19===2){
        const black=[.041,.055,.062],outline=[.38,.42,.43],ink=[.67,.61,.39];
        const face=side[0]?['z',z+1.042]:side[1]?['z',z-.042]:side[2]?['x',x-.042]:['x',x+1.042];
        if(face[0]==='z'){
          const Z=face[1];
          worldSolidBox(v,x+.26,2.79,Z-.016,x+.74,3.24,Z+.016,black,0);
          worldSolidBox(v,x+.29,3.12,Z-.024,x+.71,3.19,Z+.024,outline,0);
          for(let j=0;j<4;j++)worldSolidBox(v,x+.31+j*.088,2.88,Z-.024,x+.35+j*.088,2.98,Z+.024,j%2?ink:outline,0);
          for(const X of [x+.27,x+.72])for(const Y of [2.80,3.24])worldSolidBox(v,X-.023,Y-.022,Z-.034,X+.023,Y+.022,Z+.034,ink,0);
        }else{
          const X=face[1];
          worldSolidBox(v,X-.016,2.79,z+.26,X+.016,3.24,z+.74,black,0);
          worldSolidBox(v,X-.024,3.12,z+.29,X+.024,3.19,z+.71,outline,0);
          for(let j=0;j<4;j++)worldSolidBox(v,X-.024,2.88,z+.31+j*.088,X+.024,2.98,z+.35+j*.088,j%2?ink:outline,0);
        }
      }
      if(detail && seed%27===4){
        // Broad removable armored wall cassettes with seam and screw bosses.
        const c=rcolor(t.wall,.89),rim=rcolor(t.wall,1.45),screw=[.11,.12,.13];
        if(side[0]){
          worldSolidBox(v,x+.23,.71,z+1.017,x+.78,1.26,z+1.046,c,0);
          for(const Y of [.75,1.2])for(const X of [x+.27,x+.74])worldSolidBox(v,X-.025,Y-.023,z+1.051,X+.025,Y+.023,z+1.058,screw,0);
          worldSolidBox(v,x+.25,1.17,z+1.056,x+.76,1.21,z+1.064,rim,0);
        }
      }
      // Five distinct facades — far fewer emissive meshes in power-save mode.
      if(detail&&((x*7+z*13+level)%5===0)){
        const b=rcolor(t.accent,sectorStyle===1?.9:.5),steel=rcolor(t.wall,1.45);
        if(side[0]){
          if(sectorStyle===1||sectorStyle===3||sectorStyle===5||sectorStyle===9){worldSolidBox(v,x+.22,1.2,z+.997,x+.78,1.35,z+1.016,b,sectorStyle>=5?.55:1.6,[1,1,0,0,1,1]);worldSolidBox(v,x+.32,1.55,z+.997,x+.68,2.15,z+1.016,steel,0,[1,1,0,0,1,1]);}
          else if(sectorStyle===2||sectorStyle===4){worldSolidBox(v,x+.33,.85,z+.998,x+.39,2.75,z+1.017,b,1.3,[1,1,0,0,1,1]);worldSolidBox(v,x+.61,.85,z+.998,x+.67,2.75,z+1.017,b,1.3,[1,1,0,0,1,1]);}
        }
        if(side[1])worldSolidBox(v,x+.26,2.16,z-.019,x+.74,2.24,z+.003,b,1.3,[1,1,0,0,1,1]);
      }
    }
  }
  if(v.length){let mesh=toMesh(v);worldChunks.push({mesh,x:x0+4.5,z:z0+4.5});meshStats.triangles+=mesh.n/3;}
  }
  v=[];
  // Unlike bridge rails and walls, later set dressing may be dropped if it
  // obstructs the real elevated walkway; both drawing and collisions agree.
  worldDecorClearance=true;
  // Elevated luminous octagonal floor markings at the safe zone and boss room.
  function circleOnFloor(cx,cz,r,col,segments=28){
    for(let i=0;i<segments;i++){
      let a=TAU*i/segments,b=TAU*(i+1)/segments;
      let A=[cx+Math.cos(a)*r,.039,cz+Math.sin(a)*r];
      let B=[cx+Math.cos(b)*r,.039,cz+Math.sin(b)*r];
      let C=[cx+Math.cos(b)*(r-.06),.039,cz+Math.sin(b)*(r-.06)];
      let D=[cx+Math.cos(a)*(r-.06),.039,cz+Math.sin(a)*(r-.06)];
      quad(v,A,B,C,D,[0,1,0],col,1.15);
    }
  }
  circleOnFloor(spawnX,spawnZ,2.05,dim);
  circleOnFloor(spawnX,spawnZ,1.65,rcolor(t.accent,.3));
  if(level%5===0){circleOnFloor(spawnX,spawnZ,4.8,rcolor(t.accent,.52));circleOnFloor(spawnX,spawnZ,5.0,rcolor(t.accent,.32));}
  // Large environmental structures attached to edges, not the walkable paths.
  for(const f of mapFeatures){
    if(f.kind===3)continue;
    let c=rcolor(t.wall,1.58),light=rcolor(t.accent,.85),x=f.x,z=f.z;
    // Suspended luminous frame, deliberately higher than the player's camera.
    worldSolidBox(v,x-.62,3.72,z-.62,x+.62,3.88,z+.62,c,0,[1,1,1,1,0,1]);
    worldSolidBox(v,x-.53,3.71,z-.53,x+.53,3.73,z+.53,light,.88,[1,1,1,1,0,1]);
    if(f.kind===1){
      worldSolidBox(v,x-.64,2.82,z-.65,x-.58,3.71,z-.58,c,0);
      worldSolidBox(v,x+.58,2.82,z+.58,x+.64,3.71,z+.65,c,0);
    }
  }
  // Oversized hanging conduits and floating navigation pylons, inspired by
  // reactor gantries and museum atria: above players and enemies, no hitbox.
  const arch=sectorStyle;
  for(let k=0;k<mapRooms.length;k++){
    const r=mapRooms[k],x=r.x,z=r.z;
    if(k===0)continue;
    const accent=rcolor(t.accent,k%3===0?1.08:.61);
    const dark=rcolor(t.wall,.75),strut=rcolor(t.wall,1.7);
    const stretch=Math.min(3.7,Math.max(2.5,r.w*.30));
    // Overhead gantries and ducts make each room read as real architecture.
    // The player and enemies never collide with these high-mounted structures.
    if(detail && k%2===0){
      const half=Math.min(3.4,Math.max(1.4,Math.min(r.w,r.h)*.25));
      const steel=rcolor(t.wall,.72),light=rcolor(t.wall,1.22);
      worldSolidBox(v,x-half,3.51,z-.16,x+half,3.82,z+.16,steel,0);
      worldSolidBox(v,x-half,3.48,z-.205,x+half,3.54,z+.205,light,0);
      for(let j=-1;j<=1;j++){
        const xx=x+half*j*.72;
        worldSolidBox(v,xx-.11,3.23,z-.30,xx+.11,3.55,z+.30,steel,0);
        worldSolidBox(v,xx-.075,3.15,z-.20,xx+.075,3.24,z+.20,[.62,.58,.45],.10);
      }
    }
    // Maintenance truss, cross braces and pendant luminaires.
    if(detail&&k%3===1){
      const ox=[.105,.135,.15],frame=[.32,.34,.35],amber=[.65,.44,.20];
      for(let q=-2;q<=2;q++){
        const zz=z+q*.44;
        worldSolidBox(v,x-2.15,3.87,zz-.045,x+2.15,3.95,zz+.045,ox);
      }
      for(let q=-1;q<=1;q++){
        const xx=x+q*.91;
        worldSolidBox(v,xx-.06,3.77,z-1.15,xx+.06,3.96,z+1.15,frame);
        worldSolidBox(v,xx-.09,3.74,z-.34,xx+.09,3.765,z+.34,amber,.10);
      }
      worldSolidBox(v,x-1.4,3.72,z-.075,x+1.4,3.76,z+.075,frame);
      worldSolidBox(v,x-1.27,3.70,z-.055,x+1.27,3.72,z+.055,rcolor(t.accent,.46),.60);
    }
    // Monumental suspended illuminated hex/cross frames.
    worldSolidBox(v,x-stretch,3.92,z-.10,x+stretch,4.07,z+.10,dark,0);
    worldSolidBox(v,x-stretch,3.87,z-.055,x+stretch,3.90,z+.055,accent,1.3);
    worldSolidBox(v,x-.09,3.9,z-stretch,x+.09,4.07,z+stretch,strut,0);
    worldSolidBox(v,x-.045,3.86,z-stretch,x+.045,3.89,z+stretch,accent,.9);
    if(arch===1||arch===3){
      // Extra suspended reactor chamber ribs, bright at center.
      worldSolidBox(v,x-.52,3.45,z-.52,x+.52,3.64,z+.52,dark,0);
      worldSolidBox(v,x-.25,3.42,z-.25,x+.25,3.46,z+.25,accent,1.55);
    }else if(arch===2||arch===4){
      // Ancient floating holographic plaque, no collision.
      worldSolidBox(v,x-.78,3.18,z-.12,x+.78,3.58,z+.12,dark,0);
      worldSolidBox(v,x-.65,3.29,z-.14,x+.65,3.34,z+.14,accent,1.15);
    }
  }
  // DISTINCT LANDMARKS for the new spatial blueprints. All above walking
  // height except shallow, non-collidable floor motifs. Batched per sector.
  if(arch>=5){
    const steel=rcolor(t.wall,.60),edge=rcolor(t.wall,1.35),signal=rcolor(t.accent,.60);
    const rust=[.34,.17,.095],cold=[.64,.73,.78];
    for(let k=1;k<mapRooms.length;k++){
      const r=mapRooms[k],x=r.x,z=r.z;
      if(arch===5){ // Container loading bridges and overhead cargo cranes.
        for(const side of [-1,1]){
          worldSolidBox(v,x+side*1.9-.10,2.90,z-2.2,x+side*1.9+.10,3.93,z+2.2,edge);
          worldSolidBox(v,x+side*1.9-.10,3.70,z-2.2,x+side*1.9+.10,3.87,z+2.2,steel);
        }
        worldSolidBox(v,x-2.05,3.62,z-.18,x+2.05,3.78,z+.18,steel);
        worldSolidBox(v,x-.32,3.40,z-.32,x+.32,3.59,z+.32,rust);
        worldSolidBox(v,x-.18,3.35,z-.18,x+.18,3.38,z+.18,signal,.75);
      }else if(arch===6){ // Suspended clean-room filtration and warning rails.
        worldSolidBox(v,x-1.45,3.35,z-.9,x+1.45,3.66,z+.9,cold);
        worldSolidBox(v,x-1.30,3.30,z-.74,x+1.3,3.34,z+.74,steel);
        for(let j=-3;j<=3;j++)worldSolidBox(v,x+j*.35-.04,3.27,z-.69,x+j*.35+.04,3.30,z+.69,edge);
        worldSolidBox(v,x-.8,3.22,z-.85,x+.8,3.25,z-.79,signal,.8);
      }else if(arch===7){ // Submerged pumping mains, oxidised tubing.
        for(const side of [-1,1]){
          worldSolidBox(v,x+side*1.2-.15,3.23,z-1.5,x+side*1.2+.15,3.48,z+1.5,rust);
          for(let q=-1;q<=1;q++)worldSolidBox(v,x+side*1.2-.22,3.2,z+q*.95-.05,x+side*1.2+.22,3.52,z+q*.95+.05,edge);
        }
        worldSolidBox(v,x-1.1,3.03,z-.055,x+1.1,3.11,z+.055,signal,.85);
      }else if(arch===8){ // Orrery ribs: suspended crosses and observatory lenses.
        for(let q=-2;q<=2;q++){
          let xx=x+q*.54;
          worldSolidBox(v,xx-.05,3.12,z-.99,xx+.05,3.78,z+.99,edge);
        }
        worldSolidBox(v,x-1.30,3.55,z-.10,x+1.30,3.78,z+.10,steel);
        worldSolidBox(v,x-.26,3.18,z-.26,x+.26,3.24,z+.26,signal,1.2);
      }else{ // Metro signage, platform beams and departure gantries.
        worldSolidBox(v,x-1.95,3.05,z-.22,x+1.95,3.3,z+.22,steel);
        worldSolidBox(v,x-1.68,3.08,z-.235,x+1.68,3.20,z-.225,signal,.9);
        for(let q=-1;q<=1;q++)worldSolidBox(v,x+q*.72-.055,3.29,z-.46,x+q*.72+.055,3.77,z+.46,edge);
        worldSolidBox(v,x-.67,.034,z-.85,x+.67,.041,z-.73,[.52,.39,.12],0,[0,0,0,0,1,0]);
      }
    }
  }

  // DIRECTOR'S CUT: bold modular setpieces designed for recognizable room silhouettes.
  // Static batched triangles, not per-frame draw calls; no collision volumes.
  if(detail){
    const alloy=rcolor(t.wall,1.22),steel=rcolor(t.wall,.71),graphite=[.085,.118,.134],rim=rcolor(t.wall,1.55);
    const signal=rcolor(t.accent,1.13),signalDim=rcolor(t.accent,.47),warning=[.69,.38,.16],porcelain=[.54,.57,.55];
    const full=!touchOnly||save.settings.quality===2;
    for(let k=1;k<mapRooms.length;k+=full?2:4){
      const room=mapRooms[k],xx=room.x,zz=room.z;
      if(!Number.isFinite(xx)||!Number.isFinite(zz))continue;
      // Massive suspended service spine with telescoping structural arms.
      // Lower edge > 3m, leaving movement/jumps untouched.
      worldSolidBox(v,xx-1.80,3.27,zz-.25,xx+1.80,3.52,zz+.25,graphite);
      worldSolidBox(v,xx-1.62,3.24,zz-.31,xx+1.62,3.30,zz+.31,rim);
      for(const side of [-1,1]){
        const ax=xx+side*1.47;
        worldSolidBox(v,ax-.14,3.04,zz-.27,ax+.14,3.68,zz+.27,steel);
        worldSolidBox(v,ax-.08,3.06,zz-.32,ax+.08,3.25,zz+.32,alloy);
        worldSolidBox(v,ax-.065,3.10,zz-.335,ax+.065,3.19,zz+.335,signal,.95);
        worldSolidBox(v,ax-.24,3.64,zz-.31,ax+.24,3.80,zz+.31,graphite);
      }
      // Hanging engine core or industrial navigation terminal, varies by room.
      if(k%3===0){
        worldSolidBox(v,xx-.58,2.86,zz-.49,xx+.58,3.22,zz+.49,steel);
        worldSolidBox(v,xx-.48,2.80,zz-.35,xx+.48,2.86,zz+.35,graphite);
        for(let q=-2;q<=2;q++){
          worldSolidBox(v,xx+q*.19-.055,2.76,zz-.30,xx+q*.19+.055,2.81,zz+.30,porcelain);
          worldSolidBox(v,xx+q*.19-.031,2.745,zz-.25,xx+q*.19+.031,2.762,zz+.25,signalDim,.28);
        }
        worldSolidBox(v,xx-.29,2.720,zz-.20,xx+.29,2.747,zz+.20,signal,1.35,[0,0,0,0,0,1]);
      }else{
        for(let q=-3;q<=3;q++){
          const ax=xx+q*.37;
          worldSolidBox(v,ax-.047,3.02,zz-.63,ax+.047,3.31,zz+.63,q%2?alloy:steel);
          if(q%2===0)worldSolidBox(v,ax-.045,3.008,zz-.52,ax+.045,3.025,zz+.52,signalDim,.34,[0,0,0,0,0,1]);
        }
      }
      // Route ID panel and engineering markings on existing room floor.
      if(full){
        worldSolidBox(v,xx-1.16,.015,zz-1.17,xx+1.16,.024,zz-1.10,graphite,0,[0,0,0,0,1,0]);
        for(let q=-5;q<=5;q++){
          const px=xx+q*.195;
          worldSolidBox(v,px-.069,.027,zz-1.15,px+.017,.031,zz-1.11,(q%3===0)?warning:rim,0,[0,0,0,0,1,0]);
        }
      }
    }
    // Landmark gateway in the spawn chamber: broad alloy emblem and lights.
    const sx=spawnX,sz=spawnZ;
    worldSolidBox(v,sx-2.18,3.55,sz-2.20,sx+2.18,3.78,sz-1.97,graphite);
    worldSolidBox(v,sx-1.92,3.52,sz-2.23,sx+1.92,3.55,sz-1.95,signalDim,.74);
    for(let q=-4;q<=4;q++){
      const x=sx+q*.44;
      worldSolidBox(v,x-.10,3.49,sz-2.235,x+.10,3.515,sz-2.225,q%2?porcelain:warning,q%2?0:.32);
    }
  }
  // Hanging luminous gantries and maintenance pipes at major junctions.
  if(detail)for(let k=1;k<mapRooms.length;k+=2){
    let r=mapRooms[k],x=r.x,z=r.z;
    let shell=rcolor(t.wall,1.25),dark=rcolor(t.wall,.34),accent=rcolor(t.accent,.72);
    worldSolidBox(v,x-1.7,3.4,z-.21,x+1.7,3.54,z+.21,shell);
    worldSolidBox(v,x-1.65,3.34,z-.17,x+1.65,3.355,z+.17,accent,1.1,[0,0,0,0,0,1]);
    for(let j=-1;j<=1;j++){
      worldSolidBox(v,x+j*.75-.10,3.52,z-.32,x+j*.75+.10,3.78,z+.32,dark);
      worldSolidBox(v,x+j*.75-.075,3.54,z-.34,x+j*.75+.075,3.62,z-.31,accent,.56);
    }
  }
  // Grounded support struts, mechanical conduits and integrated warning lights.
  if(detail)for(let k=1;k<mapRooms.length;k+=3){
    const r=mapRooms[k],x=r.x,z=r.z;const steel=rcolor(t.wall,1.15),dark=rcolor(t.wall,.28),accent=rcolor(t.accent,.77);
    // Cross-shaped cable ladder under suspended gantry: 3D depth, not a sprite.
    for(let j=-2;j<=2;j++){
      worldSolidBox(v,x+j*.55-.045,3.49,z-.36,x+j*.55+.045,3.54,z+.36,steel);
      worldSolidBox(v,x+j*.55-.026,3.47,z-.32,x+j*.55+.026,3.49,z+.32,dark);
    }
    worldSolidBox(v,x-1.35,3.48,z-.38,x+1.35,3.55,z-.32,dark);
    worldSolidBox(v,x-1.35,3.48,z+.32,x+1.35,3.55,z+.38,dark);
    for(const sx of [-1,1]){
      let ax=x+sx*1.2;
      worldSolidBox(v,ax-.11,3.55,z-.12,ax+.11,3.92,z+.12,steel);
      worldSolidBox(v,ax-.07,3.62,z-.14,ax+.07,3.75,z-.123,accent,.8);
    }
    // Oil-darkened floor patches directly below service gantries.
    let floorShadow=rcolor(t.floor,.26);
    worldSolidBox(v,x-1.18,.034,z-.28,x+1.18,.039,z+.28,floorShadow,0,[0,0,0,0,1,0]);
  }
  if(detail&&(sectorStyle===16||sectorStyle===17)){
    // Fixed suspended equipment. Kept above the collision volume so it
    // cannot create navigation obstacles or make the portal unreachable.
    const frame=rcolor(t.wall,.62),bright=rcolor(t.accent,.90),alloy=rcolor(t.wall,1.34);
    for(let k=2;k<mapRooms.length;k+=2){
      const r=mapRooms[k],x=r.x,z=r.z;if(!Number.isFinite(x)||!Number.isFinite(z))continue;
      if(sectorStyle===16){
        worldSolidBox(v,x-1.45,3.51,z-.17,x+1.45,3.63,z+.17,alloy);
        for(let j=-2;j<=2;j++){
          const q=x+j*.55;
          worldSolidBox(v,q-.09,3.07,z-.36,q+.09,3.44,z+.36,frame);
          worldSolidBox(v,q-.062,3.23,z-.38,q+.062,3.30,z-.36,bright,.67);
        }
        worldSolidBox(v,x-1.4,3.05,z-.48,x+1.4,3.10,z-.42,bright,.41);
      }else{
        worldSolidBox(v,x-1.6,3.28,z-.27,x+1.6,3.45,z+.27,frame);
        for(let j=-2;j<=2;j++){
          const q=z+j*.55;
          worldSolidBox(v,x-.65,3.21,q-.05,x+.65,3.32,q+.05,alloy);
          worldSolidBox(v,x-.14,3.15,q-.06,x+.14,3.23,q+.06,bright,.8);
        }
        worldSolidBox(v,x-.32,3.31,z-.67,x+.32,3.55,z-.56,alloy);
      }
    }
  }
  // Sector origin station and destination landing pad.
  circleOnFloor(portal.x,portal.z,1.3,rcolor(t.accent,.5));
  circleOnFloor(portal.x,portal.z,.95,rcolor(t.accent,.95));
  worldMesh=toMesh(v);meshStats.triangles+=worldMesh.n/3;meshStats.chunks=worldChunks.length;
  worldDecorClearance=false;

}
