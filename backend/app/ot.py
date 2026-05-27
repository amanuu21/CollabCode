class Operation:
    def __init__(self, type, position, chars=None, length=None):
        self.type = type  # "insert" or "delete"
        self.position = position
        self.chars = chars  # for insert
        self.length = length  # for delete

def transform(op1, op2):
    """Transform op1 against op2 so they can be applied in either order"""
    
    if op1.type == "insert" and op2.type == "insert":
        if op1.position <= op2.position:
            return op1
        else:
            op1.position += len(op2.chars)
            return op1
    
    elif op1.type == "insert" and op2.type == "delete":
        if op1.position <= op2.position:
            return op1
        elif op1.position > op2.position + op2.length:
            op1.position -= op2.length
            return op1
        else:
            return None
    
    elif op1.type == "delete" and op2.type == "insert":
        if op1.position >= op2.position:
            op1.position += len(op2.chars)
            return op1
        else:
            return op1
    
    elif op1.type == "delete" and op2.type == "delete":
        if op1.position >= op2.position + op2.length:
            op1.position -= op2.length
            return op1
        elif op1.position + op1.length <= op2.position:
            return op1
        else:
            return None
    
    return op1

def apply_operation(text, op):
    """Apply a single operation to text"""
    if op is None:
        return text
    
    if op.type == "insert":
        return text[:op.position] + op.chars + text[op.position:]
    elif op.type == "delete":
        return text[:op.position] + text[op.position + op.length:]
    
    return text