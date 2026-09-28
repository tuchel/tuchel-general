import type {ReactNode} from 'react';

const sources={
  council2021:'https://bernried.de/media/download/cms/media/files/rathaus/gmr-sitzungsprotokolle/7.-sitzung-gmr-2021.pdf#page=9',
  council2025:'https://bernried.de/media/download/cms/media/files/rathaus/gmr-sitzungsprotokolle/gmr-2025/9.-sitzung-17-09-2025.pdf#page=26',
  plans:'https://bernried.de/de/rathaus/buergerservice/bebauungsplaene',
  permission:'https://www.gesetze-bayern.de/Content/Document/BayBO-55',
  setbacks:'https://www.gesetze-bayern.de/Content/Document/BayBO-6',
  energy:'https://www.gesetze-im-internet.de/geg/',
  district:'https://www.weilheim-schongau.de/buergerservice/formulare-und-merkblaetter/?filter=B'
};
function Source({href,children}:{href:string;children:ReactNode}){return <a className="permit-source" href={href} target="_blank" rel="noreferrer">{children} ↗</a>}
const possibilities=[
  ['Dining surrounded by glass','Keep developing this direction','Full-height glazing is our design preference. The stamped elevations, roof details and local plan must establish what can be approved; no property-specific glass percentage has been verified.'],
  ['Island stools, pantry and L return','Refine within the envelope','This is primarily a furniture and services layout. Check oven-door clearance, seating space, extraction and the approved room use before fixing the joinery.'],
  ['One heated kitchen and wintergarten','Confirm the approved use','An open, year-round room may differ from an unheated, thermally separated wintergarten. Compare our proposal with the approved heating, enclosure and structural design.'],
  ['Low insulated roof with timber soffits','Roof permission still unresolved','The renders explore this roof; they do not establish permission for it. Obtain the approved sections and roof conditions before choosing flat, sloped, opaque or glazed construction.'],
  ['Using all of A + B','Match the stamped outline','Our outline follows the exposé illustration. The marketing figure of about 40 m² and the application’s roughly 42 m² are not interchangeable measured allowances. Do not expand beyond the approved scheme.']
];

export function KitchenPermitting(){return <section className="kitchen-permitting" id="kitchen-permitting" aria-labelledby="permit-title">
  <div className="section-heading"><div><span className="eyebrow">FROM THE DREAM TO THE ARCHITECT’S BRIEF</span><h2 id="permit-title">What can we build?</h2></div><span className="status-chip">Research · 14 September 2026</span></div>
  <p className="permit-lead">There is a documented approval history for this property. The next step is to match our garden kitchen to that approved scheme. The word “wintergarten” alone does not tell us which roof, glazing or heated open-plan arrangement is allowed.</p>
  <div className="permit-status-grid">
    <article><span className="mini-label">REPORTED IN THE EXPOSÉ</span><h3>About 40 m²</h3><p>A wraparound addition with approval reportedly extended to <strong>20 August 2029</strong>. The floor-plan inset is labelled as a nonbinding renovation proposal.</p><Source href="/assets/expose.pdf#page=7">Exposé, addition description</Source><Source href="/assets/expose.pdf#page=19">Exposé, plan inset</Source></article>
    <article><span className="mini-label">VERIFIED IN PUBLIC RECORDS</span><h3>A site-specific exemption</h3><p>Council records identify Reitweg 25, parcel <strong>168/9</strong>, under the <strong>Reitweg development plan</strong>. The renewal record refers to a district exemption decision dated 20 August 2021.</p><Source href={sources.council2025}>2025 record, item 180</Source></article>
    <article><span className="mini-label">THE MISSING PIECE</span><h3>The stamped scheme</h3><p>We do not yet have the district renewal notice, approved drawings or conditions. Those documents establish the exact expiry, envelope and scope—not the renders.</p></article>
  </div>
  <div className="permit-history">
    <div><span className="mini-label">29 JULY 2021 · ORIGINAL APPLICATION</span><p>The council recorded roughly <strong>42 m²</strong> of additional ground area. It cited a <strong>330 m²</strong> plan allowance and approximately <strong>434 m²</strong> already built. The proposal stayed inside the building lines but exceeded the area allowance; municipal consent passed 9–5 and the application went to the district. These are historical application figures, not a new survey. <Source href={sources.council2021}>2021 record, item 125</Source></p></div>
    <div><span className="mini-label">17 SEPTEMBER 2025 · EXTENSION REQUEST</span><p>The council supported renewal 12–1, following an application submitted to the district on 6 August. Its minutes confirm the earlier exemption decision, but do not state the district’s renewed expiry date or design conditions. The exposé’s 2029 date still needs checking against that notice. <Source href={sources.council2025}>2025 renewal record</Source></p></div>
  </div>
  <h3>How that shapes this design</h3>
  <p className="muted">Working assessments for the brief, pending the approved documents.</p>
  <div className="permit-options">{possibilities.map(([title,status,body])=><article key={title}><div><h4>{title}</h4><span>{status}</span></div><p>{body}</p></article>)}</div>
  <details className="permit-details" open><summary>Local rules and year-round comfort</summary><div>
    <p><strong>The local plan comes first.</strong> Bernried’s official plan index is available, but the binding Reitweg text, amendments and property-specific conditions have not been retrieved. We cannot yet confirm roof pitch, height, materials or façade restrictions. Ask the municipality for the version applying to parcel 168/9, together with the exemption. <Source href={sources.plans}>Bernried development plans</Source></p>
    <p><strong>Changing the approved scheme needs a check.</strong> Bavarian law generally requires permission for construction, changes and changes of use unless an exception applies; an exception does not waive substantive rules. Ask the architect and Landratsamt whether our openings, roof and heated integration fit the existing decision or require an amendment. Setbacks also depend on building height and applicable local provisions. <Source href={sources.permission}>BayBO, article 55</Source> <Source href={sources.setbacks}>BayBO, article 6</Source></p>
    <p><strong>Design the glass for every season.</strong> Heated extensions fall within federal building-energy requirements. An energy consultant should establish the provisions and transitional rules applicable to this approval. Our design response should test glazing, insulated roof and floor, external shading and ventilation together, so the glass dining room remains comfortable in winter and summer. <Source href={sources.energy}>Federal building-energy law</Source></p>
    <p><strong>Keep the landscape in the brief.</strong> The exposé describes the neighbouring protected park. That does not establish whether this parcel is inside a protected boundary. Check parcel and tree constraints before changing excavation or mature planting.</p>
  </div></details>
  <div className="permit-next"><span className="mini-label">A PRECISE REQUEST FOR THE ARCHITECT / SELLER</span><h3>The documents that unlock the next round</h3><ol>
    <li>The district decision of 20 August 2021, including exemptions and conditions, plus the district’s 2025 extension notice.</li>
    <li>Stamped site plan, floor plans, sections and elevations showing approved dimensions, roof, openings and intended use.</li>
    <li>The applicable Reitweg development plan and amendments, and any thermal or structural documents submitted with the approval.</li>
  </ol><p>Then compare one specific proposal: our A+B outline, open heated connection to C, low insulated roof, full-height glass and retained structural piers. Request written confirmation of any amendments needed. <Source href={sources.district}>District building forms and guidance</Source></p></div>
</section>}
