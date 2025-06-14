#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Normalization of "someone's lot in life" using Lambeq and Categorical Quantum Linguistics
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import List, Dict, Tuple, Optional

# Simulating lambeq and discopy imports
# In a real environment you would use:
# from lambeq import BobcatParser, AtomicType, IQPAnsatz
# from discopy import rigid, tensor

# Define atomic types for pregroup grammar
class AtomicType:
    def __init__(self, name):
        self.name = name
    
    def __str__(self):
        return self.name
    
    def __repr__(self):
        return self.name
    
    def left_adjoint(self):
        return AdjointType(self, -1)
    
    def right_adjoint(self):
        return AdjointType(self, 1)

class AdjointType:
    def __init__(self, base, adjoint):
        self.base = base
        self.adjoint = adjoint
    
    def __str__(self):
        if self.adjoint == -1:
            return f"{self.base}ˡ"
        else:
            return f"{self.base}ʳ"
    
    def __repr__(self):
        return str(self)

# Define basic types
n = AtomicType('n')  # noun type
s = AtomicType('s')  # sentence type

# Define pregroup types for each word in "someone's lot in life"
someone_type = n
s_type = [n.right_adjoint(), n]  # possessive 's
lot_type = n
in_type = [n.right_adjoint(), s, n.left_adjoint()]
life_type = n

def print_pregroup_typing():
    """Print the pregroup typing for 'someone's lot in life'"""
    print("Pregroup grammar typing:")
    print(f"someone: {someone_type}")
    print(f"'s: {s_type[0]} ⊗ {s_type[1]}")
    print(f"lot: {lot_type}")
    print(f"in: {in_type[0]} ⊗ {in_type[1]} ⊗ {in_type[2]}")
    print(f"life: {life_type}")
    print("\nThis reduces to type 'n' (noun phrase) through tensor contractions")

# Tensor network representation
class Box:
    """Represent a morphism/box in a string diagram"""
    def __init__(self, name, dom, cod):
        self.name = name
        self.dom = dom  # domain (input) types
        self.cod = cod  # codomain (output) types
    
    def __str__(self):
        return self.name
    
    def __repr__(self):
        return f"{self.name}: {self.dom} → {self.cod}"

# Vector space semantics
class VectorSpace:
    """Simple vector space representation"""
    def __init__(self, dimension: int, name: str = ""):
        self.dimension = dimension
        self.name = name
    
    def random_vector(self) -> np.ndarray:
        """Generate a random unit vector in this space"""
        vec = np.random.randn(self.dimension)
        return vec / np.linalg.norm(vec)

# Semantic mapping from words to vectors
def semantic_mapping(dim: int = 4) -> Dict[str, np.ndarray]:
    """Create semantic vectors for words in the phrase"""
    # Create vector spaces
    entity_space = VectorSpace(dim, "entity")
    relation_space = VectorSpace(dim, "relation")
    context_space = VectorSpace(dim, "context")
    
    # Initialize semantic vectors
    semantics = {
        "someone": entity_space.random_vector(),
        "s_poss": np.outer(entity_space.random_vector(), entity_space.random_vector()).reshape(dim*dim),
        "lot": entity_space.random_vector(),
        "in": np.outer(relation_space.random_vector(), context_space.random_vector()).reshape(dim*dim),
        "life": context_space.random_vector()
    }
    
    return semantics

# Tensor contraction for semantic composition
def compose_meanings(semantics: Dict[str, np.ndarray], dim: int = 4) -> np.ndarray:
    """Compose the meanings according to pregroup grammar reduction"""
    # Reshape relational tensors to matrices for composition
    s_poss_matrix = semantics["s_poss"].reshape(dim, dim)
    in_matrix = semantics["in"].reshape(dim, dim)
    
    # Compositional steps (tensors contracting along pregroup grammar)
    someone_s = np.dot(s_poss_matrix, semantics["someone"])
    lot_in = np.dot(in_matrix, semantics["lot"])
    lot_in_life = np.dot(semantics["life"], lot_in)
    
    # Final composition
    result = np.outer(someone_s, lot_in_life)
    
    # Normalize the result
    result_flat = result.reshape(-1)
    return result_flat / np.linalg.norm(result_flat)

# Quantum circuit representation
class QuantumCircuit:
    """Simple representation of a quantum circuit"""
    def __init__(self, num_qubits: int):
        self.num_qubits = num_qubits
        self.gates = []
    
    def add_gate(self, gate_type: str, targets: List[int], params: Optional[List[float]] = None):
        """Add a gate to the circuit"""
        self.gates.append((gate_type, targets, params))
    
    def draw(self):
        """Draw a simple ASCII representation of the circuit"""
        circuit_lines = [f"q{i}: {'-' * 20}" for i in range(self.num_qubits)]
        
        for gate_type, targets, params in self.gates:
            # This is a very simplified drawing - a real implementation would be more complex
            if len(targets) == 1:
                # Single qubit gate
                line = circuit_lines[targets[0]]
                pos = 10  # Arbitrary position
                new_line = line[:pos] + gate_type[:1] + line[pos+1:]
                circuit_lines[targets[0]] = new_line
            elif len(targets) == 2:
                # Two qubit gate (like CNOT)
                min_target = min(targets)
                max_target = max(targets)
                for i in range(min_target, max_target + 1):
                    line = circuit_lines[i]
                    pos = 10  # Arbitrary position
                    if i == min_target:
                        new_line = line[:pos] + '•' + line[pos+1:]
                    elif i == max_target:
                        new_line = line[:pos] + 'X' + line[pos+1:]
                    else:
                        new_line = line[:pos] + '|' + line[pos+1:]
                    circuit_lines[i] = new_line
        
        return '\n'.join(circuit_lines)

# Semantic vectors to quantum circuit mapping
def create_circuit_ansatz(semantics: Dict[str, np.ndarray], dim: int = 4) -> QuantumCircuit:
    """Create an IQP-inspired circuit ansatz for the semantic representation"""
    # Determine number of qubits needed
    # For simplicity, we'll use log2(dim) qubits per word
    qubits_per_word = int(np.ceil(np.log2(dim)))
    total_qubits = qubits_per_word * 5  # 5 components in the phrase
    
    circuit = QuantumCircuit(total_qubits)
    
    # Add single-qubit rotations based on semantic vectors
    for word_idx, (word, vec) in enumerate(semantics.items()):
        start_qubit = word_idx * qubits_per_word
        for i in range(qubits_per_word):
            # Map vector components to rotation angles
            if i < len(vec):
                angle = np.arccos(vec[i % len(vec)])
                circuit.add_gate("Ry", [start_qubit + i], [angle])
    
    # Add entangling gates based on the pregroup grammar
    # someone's
    circuit.add_gate("CNOT", [0, qubits_per_word])
    # lot in
    circuit.add_gate("CNOT", [2 * qubits_per_word, 3 * qubits_per_word])
    # in life
    circuit.add_gate("CNOT", [3 * qubits_per_word, 4 * qubits_per_word])
    
    return circuit

# Normalizing "lot in life" through categorical quantum semantics
def normalize_lot_in_life(dim: int = 4) -> Dict:
    """Full process of normalizing 'someone's lot in life'"""
    # 1. Define the semantic vectors
    semantics = semantic_mapping(dim)
    
    # 2. Compose meanings via tensor contraction
    composed_meaning = compose_meanings(semantics, dim)
    
    # 3. Create quantum circuit representation
    circuit = create_circuit_ansatz(semantics, dim)
    
    # 4. Analyze the normalized representation (simplified)
    principal_components = np.linalg.svd(composed_meaning.reshape(dim, dim))[0][:2]
    
    return {
        "semantics": semantics,
        "composed_meaning": composed_meaning,
        "circuit": circuit,
        "principal_components": principal_components,
        "normalized_meaning": "A contextualized understanding of personal circumstances with emphasis on transformative potential"
    }

# Main script execution
if __name__ == "__main__":
    # Print pregroup grammar typing
    print_pregroup_typing()
    
    print("\n" + "="*50 + "\n")
    
    # Normalize the phrase
    result = normalize_lot_in_life()
    
    # Print the quantum circuit
    print("Quantum Circuit Representation:")
    print(result["circuit"].draw())
    
    print("\n" + "="*50 + "\n")
    
    # Print normalized meaning
    print("Normalized Meaning:")
    print(result["normalized_meaning"])
    
    print("\n" + "="*50 + "\n")
    
    # Print composed meaning vector (first few elements)
    print("Composed Meaning Vector (first 8 elements):")
    print(result["composed_meaning"][:8])
    
    print("\n" + "="*50 + "\n")
    
    # Categorical interpretation
    print("Categorical Interpretation:")
    print("'Someone's lot in life' represents a functor between the syntactic pregroup")
    print("category and the semantic category of vector spaces, with:")
    print("- The noun type 'n' mapped to a vector space V")
    print("- Word meanings as vectors within these spaces")
    print("- Grammatical reductions as tensor contractions")
    print("- The meaning emerging as a normalized vector in the composed space")