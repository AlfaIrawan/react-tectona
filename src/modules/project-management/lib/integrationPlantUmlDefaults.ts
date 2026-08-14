export const DEFAULT_INTEGRATION_PLANTUML = `@startuml
skinparam componentStyle rectangle
skinparam wrapWidth 180

package "Business / Application Collaboration Boundary" {
  [Komite Multi Finance] as portfolio_governance
  [Idea Intelligence Engine] as idea_engine
  [API Gateway] as api_gateway
  [API Rekomendasi AI] as recommendation_api
  [Hub Integrasi] as integration_hub
  [Paket Sinyal SLA KPR] as forecast_signal_package
  [Hasil Insight] as insight_outcome
}

package "Technology / External System Boundary" {
  node "Platform CRM" as crm_platform
  node "Platform LOS/ERP" as erp_platform
  node "Data Platform" as data_platform
  node "Layanan Eksternal" as external_services
  node "Workspace Delivery" as virea_delivery
}

portfolio_governance --> idea_engine : Serving
idea_engine --> api_gateway : Serving
idea_engine --> recommendation_api
api_gateway --> integration_hub
recommendation_api ..> integration_hub : Flow
recommendation_api ..> forecast_signal_package : Access
integration_hub ..> insight_outcome : Access
integration_hub --> crm_platform : Serving
integration_hub ..> erp_platform : Flow
integration_hub ..> data_platform : Access
integration_hub ..> external_services : Flow
insight_outcome --> virea_delivery : Serving
@enduml`
