/* AXIS v16 anatomy refinement
   Presentation only: replaces muscleMap SVG silhouette without changing muscle classification. */
(function(){
"use strict";

function silhouette(){
 return `
  <ellipse class="v16-silhouette" cx="100" cy="31" rx="16" ry="20"/>
  <path class="v16-silhouette" d="M91 49 Q92 60 85 68 Q100 74 115 68 Q108 60 109 49 Z"/>
  <path class="v16-silhouette" d="M76 71 Q100 61 124 71 Q135 80 138 105 Q138 136 127 166 L129 188 Q116 201 100 201 Q84 201 71 188 L73 166 Q62 136 62 105 Q65 80 76 71 Z"/>
  <path class="v16-silhouette" d="M72 76 Q58 76 49 88 Q43 104 40 125 L34 158 Q31 173 37 181 Q42 187 48 181 Q52 171 53 159 L58 130 Q61 109 67 96 Q71 90 77 87 Z"/>
  <path class="v16-silhouette" d="M128 76 Q142 76 151 88 Q157 104 160 125 L166 158 Q169 173 163 181 Q158 187 152 181 Q148 171 147 159 L142 130 Q139 109 133 96 Q129 90 123 87 Z"/>
  <path class="v16-silhouette" d="M74 187 Q67 205 68 229 Q69 255 72 284 Q73 299 78 307 L93 307 Q97 294 96 279 L96 204 Q86 201 74 187 Z"/>
  <path class="v16-silhouette" d="M126 187 Q133 205 132 229 Q131 255 128 284 Q127 299 122 307 L107 307 Q103 294 104 279 L104 204 Q114 201 126 187 Z"/>
  <path class="v16-silhouette" d="M78 306 Q73 324 73 345 L75 389 Q76 400 72 406 Q82 412 94 407 L93 389 Q95 365 94 344 L92 308 Z"/>
  <path class="v16-silhouette" d="M122 306 Q127 324 127 345 L125 389 Q124 400 128 406 Q118 412 106 407 L107 389 Q105 365 106 344 L108 308 Z"/>
  <path class="v16-anatomy-line" d="M85 68 Q100 77 115 68 M75 168 Q100 178 125 168 M100 202v104"/>
  <path class="v16-anatomy-line" d="M78 308 Q85 313 93 308 M107 308 Q115 313 122 308"/>
 `;
}

function front(cl){
 return `<svg viewBox="0 0 200 420" role="img" aria-label="正面の筋肉">${silhouette()}
  <path class="v16-m ${cl("肩")}" d="M74 79 Q59 78 52 91 Q55 105 67 110 Q72 98 79 88 Z"/>
  <path class="v16-m ${cl("肩")}" d="M126 79 Q141 78 148 91 Q145 105 133 110 Q128 98 121 88 Z"/>
  <path class="v16-m ${cl("胸")}" d="M78 91 Q88 83 98 91 L98 120 Q87 127 76 117 Z"/>
  <path class="v16-m ${cl("胸")}" d="M122 91 Q112 83 102 91 L102 120 Q113 127 124 117 Z"/>
  <path class="v16-m ${cl("腹筋")}" d="M88 126 Q100 121 112 126 L111 178 Q100 184 89 178 Z"/>
  <path class="v16-sep" d="M89 143h22 M89 160h22 M100 124v57"/>
  <path class="v16-m ${cl("二頭")}" d="M54 108 Q45 119 44 137 Q44 151 51 158 Q59 149 60 132 Q61 117 54 108 Z"/>
  <path class="v16-m ${cl("二頭")}" d="M146 108 Q155 119 156 137 Q156 151 149 158 Q141 149 140 132 Q139 117 146 108 Z"/>
  <path class="v16-m ${cl("大腿四頭筋")}" d="M75 207 Q69 237 74 285 Q77 298 86 301 Q94 286 93 258 L92 207 Z"/>
  <path class="v16-m ${cl("大腿四頭筋")}" d="M125 207 Q131 237 126 285 Q123 298 114 301 Q106 286 107 258 L108 207 Z"/>
  <path class="v16-m ${cl("ふくらはぎ")}" d="M78 322 Q73 349 78 382 Q82 394 89 382 Q94 350 90 322 Z"/>
  <path class="v16-m ${cl("ふくらはぎ")}" d="M122 322 Q127 349 122 382 Q118 394 111 382 Q106 350 110 322 Z"/>
 </svg>`;
}

function back(cl){
 return `<svg viewBox="0 0 200 420" role="img" aria-label="背面の筋肉">${silhouette()}
  <path class="v16-m ${cl("肩")}" d="M74 79 Q59 78 52 91 Q55 105 67 110 Q72 98 79 88 Z"/>
  <path class="v16-m ${cl("肩")}" d="M126 79 Q141 78 148 91 Q145 105 133 110 Q128 98 121 88 Z"/>
  <path class="v16-m ${cl("広背筋")}" d="M72 91 Q100 74 128 91 L124 145 Q115 162 100 171 Q85 162 76 145 Z"/>
  <path class="v16-m ${cl("脊柱起立筋")}" d="M94 118 Q100 113 106 118 L107 178 Q100 184 93 178 Z"/>
  <path class="v16-sep" d="M100 84v99"/>
  <path class="v16-m ${cl("三頭")}" d="M53 106 Q44 121 44 139 Q45 153 51 160 Q59 148 60 131 Q60 116 53 106 Z"/>
  <path class="v16-m ${cl("三頭")}" d="M147 106 Q156 121 156 139 Q155 153 149 160 Q141 148 140 131 Q140 116 147 106 Z"/>
  <path class="v16-m ${cl("臀筋")}" d="M71 190 Q82 178 98 187 L97 219 Q87 230 73 220 Z"/>
  <path class="v16-m ${cl("臀筋")}" d="M129 190 Q118 178 102 187 L103 219 Q113 230 127 220 Z"/>
  <path class="v16-m ${cl("ハム")}" d="M74 231 Q69 259 75 291 Q79 302 88 302 Q94 284 93 255 L91 230 Z"/>
  <path class="v16-m ${cl("ハム")}" d="M126 231 Q131 259 125 291 Q121 302 112 302 Q106 284 107 255 L109 230 Z"/>
  <path class="v16-m ${cl("ふくらはぎ")}" d="M77 322 Q72 349 78 383 Q83 395 90 382 Q95 350 90 322 Z"/>
  <path class="v16-m ${cl("ふくらはぎ")}" d="M123 322 Q128 349 122 383 Q117 395 110 382 Q105 350 110 322 Z"/>
 </svg>`;
}

window.muscleMap=function(rows,opts){
 const o=opts||{},on=new Set((rows||[]).flatMap(r=>musclesForExercise(r.exercise||r)));
 const cl=x=>(on.has(x)||on.has("全身"))?"on":"";
 const chips=o.chips===false?"":'<div class="ax16-chips">'+[...on].filter(x=>x!=="全身").slice(0,6).map(x=>'<span class="ax16-chip">'+esc(x)+'</span>').join("")+'</div>';
 return '<div class="ax16-figs ax16-anatomy-v2"><div class="ax16-fig"><div class="cap">FRONT</div>'+front(cl)+'</div><div class="ax16-fig"><div class="cap">BACK</div>'+back(cl)+'</div></div>'+chips;
};
})();