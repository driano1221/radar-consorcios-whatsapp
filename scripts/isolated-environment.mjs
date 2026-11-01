// Pure child-process environment builder. Never alter the production parent.
export function isolatedTestEnvironment(environment=process.env){
  const clean={...environment};
  for(const name of Object.keys(clean))if(/^(?:SEND_ENABLED|PERSIST_STATE|AI_REVIEW_ENABLED|AI_PREVIEW|BOT_STATE_PASSWORD|DEEPSEEK_API_KEY|WHATSAPP_.*|WEEKLY_.*|PENDING_DELIVERY_IDS|RECOVERY_IDS|GITHUB_TOKEN|GH_TOKEN)$/i.test(name))delete clean[name];
  return {...clean,SEND_ENABLED:'false',PERSIST_STATE:'false',AI_REVIEW_ENABLED:'false',AI_PREVIEW:'false'};
}
