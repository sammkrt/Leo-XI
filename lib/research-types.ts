export type RatingSnapshot={clubId:string;name:string;skillRating:number;observedAt:string;source:string};
export type EndpointRecord={endpoint:string;status:'ok'|'empty'|'error';observedAt:string;error?:string};
export type ResearchContext={version:1;observedAt:string;endpoints:EndpointRecord[];ratings:RatingSnapshot[];info?:Record<string,unknown>;overall?:Record<string,unknown>;season?:Record<string,unknown>;allTime?:Record<string,unknown>;members?:Record<string,unknown>[];career?:Record<string,unknown>[];playoffs?:unknown[]};
