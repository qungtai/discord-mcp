export function syncRegister(register, tools, evidence) {
  const opToTools = new Map();
  for (const t of tools) {
    for (const opId of t.operation_ids || []) {
      if (!opToTools.has(opId)) opToTools.set(opId, []);
      opToTools.get(opId).push(t);
    }
  }

  const updatedOperations = (register.operations || []).map((op) => {
    const tList = op.operation_id ? opToTools.get(op.operation_id) || [] : [];
    if (tList.length > 0) {
      const mcp_tool = tList[0].name;
      const implementation = "implemented";
      const liveTools = tList.filter((t) => evidence?.tools?.[t.name] != null);

      let verification;
      let evList;

      if (liveTools.length > 0) {
        verification = "live action verified";
        evList = liveTools.map((t) => ({
          date: evidence.date,
          tool: t.name,
          evidence: evidence.tools[t.name],
        }));
      } else {
        verification = "mocked contract tested";
        evList = [];
      }

      return {
        ...op,
        mcp_tool,
        implementation,
        verification,
        evidence: evList,
      };
    }

    const mcp_tool = null;
    let implementation;
    if (op.implementation === "deferred" || op.implementation === "obsolete") {
      implementation = op.implementation;
    } else {
      implementation = "unmapped";
    }

    return {
      ...op,
      mcp_tool,
      implementation,
      verification: op.verification,
      evidence: op.evidence || [],
    };
  });

  return {
    ...register,
    operations: updatedOperations,
  };
}

export function checkRegisterDrift(register, tools, evidence) {
  if (evidence?.tools) {
    const knownTools = new Set((tools || []).map((t) => t.name));
    for (const toolName of Object.keys(evidence.tools)) {
      if (!knownTools.has(toolName)) {
        return {
          ok: false,
          error: `live-evidence.json references unknown tool ${toolName}`,
        };
      }
    }
  }

  const expected = syncRegister(register, tools, evidence);

  for (let i = 0; i < (register.operations || []).length; i++) {
    const actualOp = register.operations[i];
    const expectedOp = expected.operations[i];
    const opId = actualOp.operation_id || actualOp.capability_id;

    if (actualOp.mcp_tool !== expectedOp.mcp_tool) {
      return {
        ok: false,
        error: `operation ${opId} mcp_tool mismatch: register has ${JSON.stringify(
          actualOp.mcp_tool,
        )}, expected ${JSON.stringify(expectedOp.mcp_tool)}`,
      };
    }
    if (actualOp.implementation !== expectedOp.implementation) {
      return {
        ok: false,
        error: `operation ${opId} implementation mismatch: register has ${JSON.stringify(
          actualOp.implementation,
        )}, expected ${JSON.stringify(expectedOp.implementation)}`,
      };
    }
    if (actualOp.verification !== expectedOp.verification) {
      return {
        ok: false,
        error: `operation ${opId} verification mismatch: register has ${JSON.stringify(
          actualOp.verification,
        )}, expected ${JSON.stringify(expectedOp.verification)}`,
      };
    }
    if (JSON.stringify(actualOp.evidence || []) !== JSON.stringify(expectedOp.evidence || [])) {
      return {
        ok: false,
        error: `operation ${opId} evidence mismatch: register has ${JSON.stringify(
          actualOp.evidence,
        )}, expected ${JSON.stringify(expectedOp.evidence)}`,
      };
    }
  }

  return { ok: true };
}
