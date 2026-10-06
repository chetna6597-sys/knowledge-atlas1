const $ = id => document.getElementById(id);

const STARTER = [
  ["Philosophy","Everything",2,"Questions about reality, knowledge, meaning and how we should live."],
  ["Hinduism","Everything",1,"A vast family of traditions, philosophies, practices and texts."],
  ["Literature","Everything",2,"Stories, forms, interpretation and literary history."],
  ["Literary theory","Literature",1,"Frameworks for interpreting texts and culture."],
  ["Music","Everything",2,"Music as art, structure, history and practice."],
  ["Piano","Music",2,"Technique, repertoire, sight-reading and musicality."],
  ["Music theory","Music",1,"The grammar and structure behind music."],
  ["Psychology","Everything",3,"How minds, behaviour and relationships work."],
  ["History","Everything",1,"Understanding people and societies through time."],
  ["Pop culture","Everything",1,"Film, television, celebrities, internet culture, fandoms and trends."],
  ["Science","Everything",1,"The natural world and the methods used to understand it."],
  ["Public health","Everything",3,"Health at the population and systems level."],
  ["Education","Everything",3,"Learning, institutions, pedagogy and education systems."],
  ["Business","Everything",2,"Organizations, markets, strategy and value creation."],
  ["China","Everything",2,"History, society, language, politics, culture and contemporary China."],
  ["Languages","Everything",1,"Language learning, linguistics and communication."],
  ["Art","Everything",1,"Visual culture, artists, movements and aesthetics."]
];

const TERRITORY_COLORS = [
  "#b9a1ff","#e6b47c","#e7cf78","#91d8c2","#e2a2c4","#9bb9e6",
  "#8fc6b0","#d99acb","#8bbce8","#d5b0e8","#9bc995","#d8a7b9"
];

const state = {
  nodes: [],
  edges: [],
  selected: null,
  transform: d3.zoomIdentity,
  zoom: null
};

function uid(prefix="local"){
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function statusFor(n){
  return ["curious","exploring","familiar","strong","deep"][Math.max(1,Math.min(5,n))-1];
}

function starter(){
  const root = {id:"root",name:"My Knowledge",parent_id:null,category:"Everything",confidence:5,status:"deep",description:"The whole map."};
  const nodes=[root], ids={root:root.id};
  for(const [name,parent,level,description] of STARTER){
    const p = parent==="Everything" ? root : nodes.find(n=>n.name===parent);
    const node={
      id:uid(),name,parent_id:p?.id||root.id,
      category:parent==="Everything"?name:(p?.category||"Other"),
      confidence:level,status:statusFor(level),description
    };
    nodes.push(node); ids[name]=node.id;
  }
  return nodes;
}

function loadLocal(){
  try{
    const raw=localStorage.getItem("knowledge-atlas-state-v2");
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {nodes:starter(),edges:[]};
}

function saveLocal(){
  localStorage.setItem("knowledge-atlas-state-v2",JSON.stringify({nodes:state.nodes,edges:state.edges}));
}

function colorFor(node){
  if(node.id==="root") return "#f3efe7";
  const territory = state.nodes.find(n=>n.id===node.territoryId);
  const key = territory?.id || node.id;
  let hash=0;
  for(const ch of key) hash=(hash*31+ch.charCodeAt(0))>>>0;
  return TERRITORY_COLORS[hash%TERRITORY_COLORS.length];
}

function territories(){
  return state.nodes.filter(n=>n.id!=="root" && n.parent_id==="root");
}

function descendants(id){
  const out=[];
  const queue=[id];
  while(queue.length){
    const current=queue.shift();
    for(const n of state.nodes.filter(x=>x.parent_id===current)){
      out.push(n); queue.push(n.id);
    }
  }
  return out;
}

function assignTerritories(){
  const roots=territories();
  for(const n of state.nodes){
    if(n.id==="root") {n.territoryId=null;continue;}
    let cur=n;
    while(cur.parent_id && cur.parent_id!=="root"){
      cur=state.nodes.find(x=>x.id===cur.parent_id)||cur;
    }
    n.territoryId=cur.id;
  }
}

function render(){
  assignTerritories();
  renderStats();
  renderFilters();
  renderGraph();
  renderSuggestions();
  renderInspector();
  populateParentOptions();
}

function renderStats(){
  const n=state.nodes.filter(x=>x.id!=="root");
  const deep=n.filter(x=>x.confidence>=4).length;
  const areas=new Set(n.map(x=>x.territoryId||x.category)).size;
  $("stats").innerHTML=[
    [n.length,"ideas mapped"],
    [areas,"knowledge territories"],
    [deep,"strong / deep"],
    [state.edges.length,"connections"],
    [n.filter(x=>(x.description||"").includes("?")).length,"open questions"]
  ].map(([a,b])=>`<div class="stat"><b>${a}</b><span>${b}</span></div>`).join("");
}

function renderFilters(){
  const current=$("categoryFilter").value||"all";
  const cats=territories().map(n=>n.name).sort();
  $("categoryFilter").innerHTML=`<option value="all">All territories</option>`+
    cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  $("categoryFilter").value=cats.includes(current)?current:"all";
}

function filteredNodes(){
  const q=$("search").value.trim().toLowerCase();
  const cat=$("categoryFilter").value;
  return state.nodes.filter(n=>{
    if(n.id==="root") return true;
    const territory=state.nodes.find(x=>x.id===n.territoryId);
    return (!cat || cat==="all" || territory?.name===cat) &&
      (!q || `${n.name} ${n.category} ${n.description}`.toLowerCase().includes(q));
  });
}

function layoutNodes(nodes, width, height){
  const root=nodes.find(n=>n.id==="root");
  const visibleIds=new Set(nodes.map(n=>n.id));
  const roots=nodes.filter(n=>n.id!=="root"&&n.parent_id==="root");
  const positions=new Map();
  const cx=width/2, cy=height/2;
  positions.set("root",{x:cx,y:cy,r:20,depth:0});

  const ring=Math.min(width,height)*.30;
  roots.forEach((n,i)=>{
    const angle=(i/Math.max(roots.length,1))*Math.PI*2-Math.PI/2;
    positions.set(n.id,{
      x:cx+ring*Math.cos(angle), y:cy+ring*Math.sin(angle),
      r:22, depth:1, angle
    });
  });

  for(const parent of roots){
    const kids=nodes.filter(n=>n.parent_id===parent.id);
    const p=positions.get(parent.id);
    const childRing=Math.min(width,height)*.13;
    kids.forEach((n,i)=>{
      const spread=Math.min(1.3,Math.max(.55,kids.length*.18));
      const angle=p.angle+(i-(kids.length-1)/2)*spread/Math.max(kids.length,1);
      positions.set(n.id,{
        x:p.x+childRing*Math.cos(angle),
        y:p.y+childRing*Math.sin(angle),
        r:9,depth:2,angle
      });
    });
  }

  // Deeper nodes: place in a small orbit around their parent.
  const deeper=nodes.filter(n=>n.id!=="root"&&n.parent_id!=="root");
  deeper.forEach(n=>{
    if(positions.has(n.id)) return;
    const p=positions.get(n.parent_id);
    if(!p) return;
    const siblings=deeper.filter(x=>x.parent_id===n.parent_id);
    const i=siblings.findIndex(x=>x.id===n.id);
    const angle=(p.angle||0)+(i-(siblings.length-1)/2)*.7;
    positions.set(n.id,{x:p.x+48*Math.cos(angle),y:p.y+48*Math.sin(angle),r:8,depth:3,angle});
  });

  // Keep the map from getting too crowded at the edges.
  for(const [id,p] of positions){
    p.x=Math.max(55,Math.min(width-55,p.x));
    p.y=Math.max(55,Math.min(height-55,p.y));
  }
  return positions;
}

function renderGraph(){
  const host=$("graph");
  const nodes=filteredNodes();
  const visibleIds=new Set(nodes.map(n=>n.id));
  const width=Math.max(host.clientWidth,700);
  const height=Math.max(host.clientHeight,600);
  const positions=layoutNodes(nodes,width,height);

  host.innerHTML="";
  const svg=d3.select(host).append("svg")
    .attr("viewBox",`0 0 ${width} ${height}`)
    .attr("role","img")
    .attr("aria-label","Interactive knowledge map");

  const viewport=svg.append("g").attr("class","viewport");
  const edgesLayer=viewport.append("g");
  const nodesLayer=viewport.append("g");

  state.zoom=d3.zoom().scaleExtent([0.45,2.7]).on("zoom",e=>{
    state.transform=e.transform;
    viewport.attr("transform",e.transform);
  });
  svg.call(state.zoom).on("dblclick.zoom",null);

  const edges=state.edges.filter(e=>visibleIds.has(e.source_id)&&visibleIds.has(e.target_id));
  edges.forEach(e=>{
    const a=positions.get(e.source_id), b=positions.get(e.target_id);
    if(!a||!b)return;
    edgesLayer.append("line")
      .attr("class",e.source_id===state.selected||e.target_id===state.selected?"edge selected":"edge")
      .attr("x1",a.x).attr("y1",a.y).attr("x2",b.x).attr("y2",b.y);
  });

  nodes.forEach(n=>{
    const p=positions.get(n.id);
    if(!p)return;
    const territory=n.id==="root"?null:state.nodes.find(x=>x.id===n.territoryId);
    const isTerritory=n.parent_id==="root";
    const selected=n.id===state.selected;
    const matches=!state.selected || selected || n.parent_id===state.selected || n.territoryId===state.selected ||
      state.edges.some(e=>(e.source_id===state.selected&&e.target_id===n.id)||(e.target_id===state.selected&&e.source_id===n.id));

    const g=nodesLayer.append("g")
      .attr("class",`node ${isTerritory?"territory":"child"} ${selected?"selected ":""} ${matches?"":"dim"}`)
      .attr("transform",`translate(${p.x},${p.y})`)
      .on("click",(event)=>{
        event.stopPropagation();
        state.selected=n.id;
        renderGraph();
        renderInspector();
      });

    const fill=n.id==="root"?"#f3efe7":colorFor(n);
    const radius=isTerritory?18:(n.confidence>=4?10:8);

    g.append("circle").attr("class","halo").attr("r",radius+8).attr("fill",fill).attr("fill-opacity",.08);
    g.append("circle").attr("class","bubble").attr("r",radius).attr("fill",fill).attr("fill-opacity",isTerritory?.18:.12);

    const label=esc(n.name);
    const textWidth=Math.max(45,Math.min(150,10+label.length*(isTerritory?7.1:6.1)));
    const y=isTerritory?radius+17:radius+14;
    g.append("rect").attr("class","label-bg").attr("x",-textWidth/2).attr("y",y-11).attr("width",textWidth).attr("height",21).attr("rx",10);
    g.append("text").attr("class","label").attr("text-anchor","middle").attr("y",y+4).text(n.name);

    if(isTerritory){
      g.append("text").attr("text-anchor","middle").attr("y",y+18)
        .attr("fill","#6f6877").attr("font-size","9px").text(`${descendants(n.id).length+1} ideas`);
    }
  });

  svg.on("click",()=>{state.selected=null;renderGraph();renderInspector()});

  // Restore current zoom when possible.
  if(state.transform){
    viewport.attr("transform",state.transform);
    svg.call(state.zoom.transform,state.transform);
  }
}

function renderSuggestions(){
  const suggestions=makeSuggestions();
  $("suggestions").innerHTML=suggestions.length?suggestions.slice(0,4).map((s,i)=>`
    <div class="suggestion">
      <strong>${esc(s.topic)}</strong>
      <small>${esc(s.reason)}</small>
      <button data-sug="${i}">Add to map</button>
    </div>`).join(""):`<div class="empty" style="padding:20px">Add more ideas and your next directions will evolve.</div>`;
  $("suggestions").querySelectorAll("[data-sug]").forEach(btn=>btn.addEventListener("click",()=>{
    addSuggested(suggestions[Number(btn.dataset.sug)]);
  }));
}

function makeSuggestions(){
  const rules={
    Philosophy:["Phenomenology","Logic","Aesthetics","Political philosophy","Philosophy of mind"],
    Hinduism:["Upanishads","Vedanta","Bhagavad Gita","Samkhya","Bhakti","Nyaya","Yoga philosophy"],
    Literature:["Narratology","Comparative literature","World literature"],
    "Literary theory":["Structuralism","Post-structuralism","Deconstruction","Feminist criticism","Psychoanalytic criticism"],
    Music:["Harmony","Ear training","Music history","Composition","Improvisation"],
    Piano:["Sight reading","Scales","Chord voicings","Improvisation","Classical repertoire"],
    "Music theory":["Intervals","Scales","Harmony","Cadences","Counterpoint"],
    Psychology:["Cognitive psychology","Social psychology","Developmental psychology","Personality","Cognitive biases"],
    "Pop culture":["Film theory","Celebrity culture","Internet culture","Fandom studies","Media economics"],
    History:["Historiography","Economic history","Social history","Political history"],
    Science:["Scientific method","Statistics","Evolution","Physics","Astronomy"],
    China:["Modern Chinese history","Chinese political economy","Chinese philosophy","Chinese language","China–India relations"],
    Business:["Economics","Strategy","Organizations","Finance","Entrepreneurship"],
    Art:["Art history","Aesthetics","Modernism","Contemporary art","Visual culture"]
  };
  const existing=new Set(state.nodes.map(n=>n.name.toLowerCase()));
  const sourceNodes=state.selected ? [state.nodes.find(n=>n.id===state.selected)] : state.nodes.filter(n=>n.id!=="root");
  const out=[];
  for(const n of sourceNodes.filter(Boolean)){
    const key=n.name;
    const ideas=rules[key]||[];
    for(const topic of ideas){
      if(!existing.has(topic.toLowerCase())){
        out.push({
          topic,
          source:n,
          reason:`A natural next branch from ${n.name}. It deepens a pathway already present in your atlas.`
        });
      }
    }
  }
  if(!out.length){
    for(const n of state.nodes.filter(x=>x.id!=="root")){
      const ideas=rules[n.name]||[];
      for(const topic of ideas){
        if(!existing.has(topic.toLowerCase())) out.push({topic,source:n,reason:`A possible next step from ${n.name}.`});
      }
    }
  }
  return out;
}

function addSuggested(s){
  const node={
    id:uid(),name:s.topic,parent_id:s.source.id,
    category:s.source.category,confidence:1,status:"curious",description:""
  };
  state.nodes.push(node);
  state.selected=node.id;
  saveLocal();
  render();
}

function renderInspector(){
  const n=state.nodes.find(x=>x.id===state.selected);
  if(!n){
    $("inspector").innerHTML=`<div class="empty"><div class="empty-icon">✦</div><strong>Choose an idea</strong><p>Click something on the map to see what you've mapped around it.</p></div>`;
    return;
  }
  const children=state.nodes.filter(x=>x.parent_id===n.id);
  const links=state.edges.filter(e=>e.source_id===n.id||e.target_id===n.id);
  const territory=state.nodes.find(x=>x.id===n.territoryId);
  $("inspector").innerHTML=`
    <div class="detail-kicker">${n.parent_id==="root"?"TERRITORY":"CONCEPT"}</div>
    <div class="detail-title">${esc(n.name)}</div>
    <span class="pill">${esc(territory?.name||n.category)} · ${esc(statusFor(n.confidence))}</span>
    <div class="description">${esc(n.description||"No notes yet. Add a thought, question or rough definition as you learn.")}</div>
    <div class="subhead">PATHWAYS</div>
    ${children.map(c=>`<div class="connection" data-node="${c.id}">→ <b>${esc(c.name)}</b></div>`).join("")||"<div class='description' style='margin:9px 0'>No branches yet.</div>"}
    ${links.length?`<div class="subhead">CROSS-CONNECTIONS</div>`:""}
    ${links.map(e=>{
      const other=state.nodes.find(x=>x.id===(e.source_id===n.id?e.target_id:e.source_id));
      return other?`<div class="connection" data-node="${other.id}">↔ ${esc(e.relationship)} · <b>${esc(other.name)}</b></div>`:"";
    }).join("")}
    <div class="inspector-actions">
      <button id="connectNode">Connect ideas</button>
      <button id="editNode">Edit</button>
      ${n.id!=="root"?`<button id="deleteNode">Delete</button>`:""}
    </div>`;
  $("inspector").querySelectorAll("[data-node]").forEach(el=>el.addEventListener("click",()=>{
    state.selected=el.dataset.node;renderGraph();renderInspector();
  }));
  $("editNode").addEventListener("click",()=>editNode(n));
  $("connectNode").addEventListener("click",()=>openConnection(n.id));
  $("deleteNode")?.addEventListener("click",()=>{
    if(confirm(`Remove ${n.name} and its direct branches?`)){
      const ids=new Set([n.id,...state.nodes.filter(x=>x.parent_id===n.id).map(x=>x.id)]);
      state.nodes=state.nodes.filter(x=>!ids.has(x.id));
      state.edges=state.edges.filter(e=>!ids.has(e.source_id)&&!ids.has(e.target_id));
      state.selected=null;saveLocal();render();
    }
  });
}

function populateParentOptions(){
  $("nodeParent").innerHTML=state.nodes.map(n=>{
    const indent=n.id==="root"?"":"↳ ";
    return `<option value="${n.id}">${indent}${esc(n.name)}</option>`;
  }).join("");
  if(state.selected && state.nodes.some(n=>n.id===state.selected)) $("nodeParent").value=state.selected;
}

function editNode(n){
  const description=prompt("Notes / questions:",n.description||"");
  if(description!==null)n.description=description;
  const level=prompt("Depth 1–5:",n.confidence);
  if(level!==null)n.confidence=Math.max(1,Math.min(5,Number(level)||n.confidence));
  n.status=statusFor(n.confidence);saveLocal();render();
}

function openConnection(id){
  $("edgeSource").innerHTML=state.nodes.map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join("");
  $("edgeTarget").innerHTML=state.nodes.map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join("");
  $("edgeSource").value=id;
  $("edgeTarget").value=state.nodes.find(n=>n.id!==id)?.id||id;
  $("connectionDialog").showModal();
}

function zoomBy(factor){
  if(!state.zoom)return;
  const svg=d3.select("#graph svg");
  svg.transition().duration(250).call(state.zoom.scaleBy,factor);
}

function resetZoom(){
  if(!state.zoom)return;
  const svg=d3.select("#graph svg");
  svg.transition().duration(300).call(state.zoom.transform,d3.zoomIdentity);
}

$("addNode").addEventListener("click",()=>{
  $("nodeForm").reset();populateParentOptions();$("nodeDialog").showModal();
});
$("nodeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const parent=$("nodeParent").value;
  const level=Number($("nodeLevel").value);
  const node={
    id:uid(),name:$("nodeName").value.trim(),category:$("nodeCategory").value.trim()||"Other",
    parent_id:parent,confidence:level,status:statusFor(level),description:$("nodeDescription").value.trim()
  };
  if(!node.name)return;
  state.nodes.push(node);state.selected=node.id;saveLocal();$("nodeDialog").close();render();
});
$("connectionForm").addEventListener("submit",e=>{
  e.preventDefault();
  const source=$("edgeSource").value,target=$("edgeTarget").value,relationship=$("edgeType").value;
  if(source===target)return;
  const exists=state.edges.some(x=>
    ((x.source_id===source&&x.target_id===target)||(x.source_id===target&&x.target_id===source)) &&
    x.relationship===relationship
  );
  if(!exists)state.edges.push({id:uid("edge"),source_id:source,target_id:target,relationship});
  saveLocal();$("connectionDialog").close();render();
});
$("search").addEventListener("input",()=>{state.selected=null;renderGraph();renderInspector()});
$("categoryFilter").addEventListener("change",()=>{state.selected=null;renderGraph();renderInspector()});
$("refreshSuggestions").addEventListener("click",renderSuggestions);
$("rabbitHole").addEventListener("click",()=>{
  const suggestions=makeSuggestions();
  if(!suggestions.length){alert("Keep adding ideas — your rabbit-hole engine needs a little more of your map to work with.");return;}
  const s=suggestions[Math.floor(Math.random()*Math.min(suggestions.length,6))];
  state.selected=s.source.id;renderGraph();renderInspector();
  alert(`Try this rabbit hole:\\n\\n${s.source.name} → ${s.topic}\\n\\n${s.reason}`);
});
$("fitView").addEventListener("click",resetZoom);
$("zoomOutAll").addEventListener("click",()=>{state.selected=null;resetZoom();renderGraph();renderInspector()});
$("zoomIn").addEventListener("click",()=>zoomBy(1.2));
$("zoomOut").addEventListener("click",()=>zoomBy(.82));
$("zoomReset").addEventListener("click",resetZoom);

function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

async function init(){
  const local=loadLocal();
  state.nodes=local.nodes;
  state.edges=local.edges;
  try{
    if(window.initSupabase) await initSupabase();
  }catch(e){}
  render();
}
init();
