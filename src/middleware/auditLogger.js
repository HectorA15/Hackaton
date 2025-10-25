const AuditLog = require('../models/AuditLog');

const auditLogger = (action, entityType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      res.send = originalSend;
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = req.params.id || req.body?.id || null;
        
        AuditLog.create({
          user_id: req.user?.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          changes: req.body,
          ip_address: req.ip || req.connection.remoteAddress
        }).catch(err => console.error('Audit log error:', err));
      }
      
      return res.send(data);
    };
    
    next();
  };
};

module.exports = auditLogger;
