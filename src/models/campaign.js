export class CampaignModel {
  constructor(db) {
    this.db = db;
  }

  createCampaign(name, keyword, responseMessage, type, userId, templateData = {}) {
    const stmt = this.db.prepare(
      'INSERT INTO campaigns (name, keyword, response_message, type, template_data, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    );
    return stmt.run(name, keyword, responseMessage, type, JSON.stringify(templateData), userId);
  }

  getCampaignByKeyword(keyword) {
    const stmt = this.db.prepare('SELECT * FROM campaigns WHERE keyword = ?');
    return stmt.get(keyword);
  }

  getCampaignsByUser(userId) {
    const stmt = this.db.prepare('SELECT * FROM campaigns WHERE created_by = ?');
    return stmt.all(userId);
  }

  logMessage(campaignId, fromNumber, toNumber, message, status) {
    const stmt = this.db.prepare(
      'INSERT INTO message_logs (campaign_id, from_number, to_number, message, status) VALUES (?, ?, ?, ?, ?)'
    );
    return stmt.run(campaignId, fromNumber, toNumber, message, status);
  }
}