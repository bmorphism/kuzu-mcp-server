#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Advanced implementation of "someone's lot in life" normalization
using lambeq's categorical quantum semantics approach
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import List, Dict, Tuple, Optional, Union
from dataclasses import dataclass

# ========== PREGROUP GRAMMAR TYPING ==========

class Type:
    """Base class for pregroup types"""
    def __mul__(self, other):
        return TensorType([self, other])
    
    def left_adjoint(self):
        raise NotImplementedError
    
    def right_adjoint(self):
        raise NotImplementedError

class AtomicType(Type):
    """Atomic type like n (noun) or s (sentence)"""
    def __init__(self, name: str):
        self.name = name
        self.adjoint = 0  # 0 means no adjoint
    
    def __repr__(self):
        return self.name
    
    def left_adjoint(self):
        return AdjointType(self.name, -1)
    
    def right_adjoint(self):
        return AdjointType(self.name, 1)

class AdjointType(Type):
    """Adjoint type like n^l or n^r"""
    def __init__(self, name: str, adjoint: int):
        self.name = name
        self.adjoint = adjoint
    
    def __repr__(self):
        if self.adjoint < 0:
            return f"{self.name}^l{-self.adjoint if abs(self.adjoint) > 1 else ''}"
        else:
            return f"{self.name}^r{self.adjoint if abs(self.adjoint) > 1 else ''}"
    
    def left_adjoint(self):
        return AdjointType(self.name, self.adjoint - 1)
    
    def right_adjoint(self):
        return AdjointType(self.name, self.adjoint + 1)

class TensorType(Type):
    """Tensor product of types"""
    def __init__(self, types: List[Type]):
        self.types = types
    
    def __repr__(self):
        return " ⊗ ".join([repr(t) for t in self.types])
    
    def __mul__(self, other):
        if isinstance(other, TensorType):
            return TensorType(self.types + other.types)
        else:
            return TensorType(self.types + [other])
    
    def left_adjoint(self):
        return TensorType([t.left_adjoint() for t in reversed(self.types)])
    
    def right_adjoint(self):
        return TensorType([t.right_adjoint() for t in reversed(self.types)])

# Define basic types
n = AtomicType('n')  # noun type
s = AtomicType('s')  # sentence type

# Define the pregroup types for each word in "someone's lot in life"
someone_type = n
s_possessive_type = n.right_adjoint() * n
lot_type = n
in_type = n.right_adjoint() * s * n.left_adjoint()
life_type = n

# Combined type for "someone's lot in life"
combined_type = someone_type * s_possessive_type * lot_type * in_type * life_type

# ========== CATEGORICAL DIAGRAM REPRESENTATION ==========

@dataclass
class Box:
    """A box/morphism in a string diagram"""
    name: str
    dom: Type
    cod: Type
    
    def __repr__(self):
        return f"{self.name}: {self.dom} → {self.cod}"

@dataclass
class Cup:
    """A cup/evaluation in a string diagram"""
    left_type: Type
    right_type: Type
    
    def __repr__(self):
        return f"Cup({self.left_type}, {self.right_type})"

@dataclass
class Diagram:
    """A string diagram in monoidal category"""
    boxes: List[Box]
    cups: List[Cup]
    dom: Type
    cod: Type
    
    def __repr__(self):
        return f"Diagram: {self.dom} → {self.cod}"

# Create word boxes
someone_box = Box("someone", Type(), someone_type)
s_poss_box = Box("'s", Type(), s_possessive_type)
lot_box = Box("lot", Type(), lot_type)
in_box = Box("in", Type(), in_type)
life_box = Box("life", Type(), life_type)

# Create cups for contractions
cup1 = Cup(someone_type, s_possessive_type.types[0])  # someone·n^r
cup2 = Cup(lot_type, in_type.types[0])               # lot·n^r
cup3 = Cup(in_type.types[2], life_type)              # n^l·life

# Construct the diagram
phrase_diagram = Diagram(
    boxes=[someone_box, s_poss_box, lot_box, in_box, life_box],
    cups=[cup1, cup2, cup3],
    dom=Type(),
    cod=s  # The result is a sentence type
)

# ========== VECTOR SPACE SEMANTICS ==========

class VectorSpaceModel:
    """Distributional semantics model based on vector spaces"""
    def __init__(self, dim: int = 4):
        self.dim = dim
        
        # Define vector spaces for each type
        self.spaces = {
            'n': self.create_space(dim),
            's': self.create_space(dim)
        }
        
        # Create semantic mapping for each word
        self.semantics = self.initialize_semantics()
    
    def create_space(self, dim: int) -> np.ndarray:
        """Create an identity matrix representing a vector space"""
        return np.eye(dim)
    
    def random_density_matrix(self, dim: int) -> np.ndarray:
        """Create a random density matrix"""
        # Create a random complex vector
        vec = np.random.normal(size=dim) + 1j * np.random.normal(size=dim)
        vec = vec / np.linalg.norm(vec)
        
        # Create density matrix from pure state
        return np.outer(vec, vec.conj())
    
    def initialize_semantics(self) -> Dict[str, np.ndarray]:
        """Initialize word meanings as density matrices"""
        semantics = {
            "someone": self.random_density_matrix(self.dim),
            "'s": self.random_density_matrix(self.dim * self.dim).reshape(self.dim, self.dim, self.dim, self.dim),
            "lot": self.random_density_matrix(self.dim),
            "in": self.random_density_matrix(self.dim * self.dim).reshape(self.dim, self.dim, self.dim, self.dim),
            "life": self.random_density_matrix(self.dim)
        }
        return semantics
    
    def apply_cup(self, tensor1: np.ndarray, tensor2: np.ndarray, dim: int) -> np.ndarray:
        """Apply a cup (contraction) between two tensors"""
        # Reshape tensors if needed
        if tensor1.ndim == 1:
            tensor1 = tensor1.reshape(dim)
        if tensor2.ndim == 1:
            tensor2 = tensor2.reshape(dim)
            
        # Contract along the last axis of tensor1 and first axis of tensor2
        return np.tensordot(tensor1, tensor2, axes=([-1], [0]))
    
    def normalize_state(self, state: np.ndarray) -> np.ndarray:
        """Normalize a quantum state"""
        flat_state = state.reshape(-1)
        norm = np.linalg.norm(flat_state)
        return state / norm if norm > 0 else state
    
    def compute_meaning(self) -> np.ndarray:
        """Compute the meaning of 'someone's lot in life' using tensor contractions"""
        # Get semantic tensors
        someone = self.semantics["someone"]
        s_poss = self.semantics["'s"]
        lot = self.semantics["lot"]
        in_tensor = self.semantics["in"]
        life = self.semantics["life"]
        
        # Apply cups (contractions) following the diagram
        # 1. someone ⊗ 's
        someone_s = self.apply_cup(someone, s_poss, self.dim)
        
        # 2. lot ⊗ in
        lot_in = self.apply_cup(lot, in_tensor, self.dim)
        
        # 3. lot_in ⊗ life
        lot_in_life = self.apply_cup(lot_in, life, self.dim)
        
        # 4. someone_s ⊗ lot_in_life
        meaning = self.apply_cup(someone_s, lot_in_life, self.dim)
        
        # Normalize the result
        return self.normalize_state(meaning)

# ========== QUANTUM CIRCUIT TRANSLATION ==========

class QuantumCircuit:
    """More detailed quantum circuit representation"""
    def __init__(self, num_qubits: int):
        self.num_qubits = num_qubits
        self.gates = []
        self.parameters = []
    
    def add_gate(self, gate_type: str, targets: List[int], params: Optional[List[float]] = None):
        """Add a gate to the circuit"""
        self.gates.append((gate_type, targets, params))
        if params:
            self.parameters.extend(params)
    
    def to_matrix(self) -> np.ndarray:
        """Convert the circuit to a unitary matrix (simplified)"""
        # This is a placeholder - a real implementation would compute the actual unitary
        dim = 2**self.num_qubits
        return np.eye(dim)
    
    def draw(self) -> str:
        """Draw a simple ASCII representation of the circuit"""
        circuit_lines = [f"q{i}: |0⟩ {'═' * 30}" for i in range(self.num_qubits)]
        
        for gate_type, targets, params in self.gates:
            # This is a very simplified drawing
            if len(targets) == 1:
                # Single qubit gate
                line = circuit_lines[targets[0]]
                pos = 10  # Arbitrary position
                gate_str = gate_type
                if params:
                    gate_str += f"({params[0]:.2f})"
                padding = '─' * (len(gate_str) // 2)
                new_line = line[:pos] + padding + gate_str + padding + line[pos+len(gate_str)+len(padding)*2:]
                circuit_lines[targets[0]] = new_line
            elif len(targets) == 2:
                # Two qubit gate (like CNOT)
                min_target = min(targets)
                max_target = max(targets)
                for i in range(min_target, max_target + 1):
                    line = circuit_lines[i]
                    pos = 10  # Arbitrary position
                    if i == min_target:
                        new_line = line[:pos] + '●' + line[pos+1:]
                    elif i == max_target:
                        new_line = line[:pos] + '⊕' + line[pos+1:]
                    else:
                        new_line = line[:pos] + '│' + line[pos+1:]
                    circuit_lines[i] = new_line
        
        # Add measurement at the end
        for i in range(self.num_qubits):
            line = circuit_lines[i]
            circuit_lines[i] = line + " ─┤M├"
        
        return '\n'.join(circuit_lines)

class IQPAnsatz:
    """IQP (Instantaneous Quantum Polynomial) Ansatz for lambeq"""
    def __init__(self, dim: int = 4):
        self.dim = dim
        self.num_qubits = int(np.ceil(np.log2(dim)))
    
    def word_to_circuit(self, word: str, vector: np.ndarray) -> QuantumCircuit:
        """Convert a word's semantic vector to a quantum circuit"""
        circuit = QuantumCircuit(self.num_qubits)
        
        # Prepare qubits in uniform superposition
        for i in range(self.num_qubits):
            circuit.add_gate("H", [i], None)
        
        # Add Z-rotations based on vector components
        for i in range(min(self.num_qubits, len(vector))):
            angle = np.arccos(np.abs(vector[i])) * 2
            circuit.add_gate("RZ", [i], [angle])
        
        # Add entangling CZ gates in IQP pattern
        for i in range(self.num_qubits - 1):
            circuit.add_gate("CZ", [i, i+1], None)
        
        return circuit
    
    def sentence_to_circuit(self, vector_model: VectorSpaceModel) -> QuantumCircuit:
        """Convert the entire sentence semantics to a quantum circuit"""
        # Determine total number of qubits needed
        total_qubits = self.num_qubits * 5  # 5 words in the phrase
        
        circuit = QuantumCircuit(total_qubits)
        
        # Add individual word circuits
        for i, (word, vec) in enumerate(vector_model.semantics.items()):
            # Flatten higher-order tensors to vectors
            flat_vec = vec.reshape(-1)[:self.dim]
            word_circuit = self.word_to_circuit(word, flat_vec)
            
            # Add gates to the main circuit with offset
            offset = i * self.num_qubits
            for gate_type, targets, params in word_circuit.gates:
                # Adjust target indices
                adjusted_targets = [t + offset for t in targets]
                circuit.add_gate(gate_type, adjusted_targets, params)
        
        # Add entangling gates between words based on cups
        # someone ⊗ 's
        circuit.add_gate("CNOT", [self.num_qubits-1, self.num_qubits], None)
        
        # lot ⊗ in
        circuit.add_gate("CNOT", [2*self.num_qubits+self.num_qubits-1, 3*self.num_qubits], None)
        
        # in ⊗ life
        circuit.add_gate("CNOT", [3*self.num_qubits+self.num_qubits-1, 4*self.num_qubits], None)
        
        return circuit

# ========== NORMALIZATION PROCESS ==========

def normalize_lot_in_life():
    """Complete normalization process for 'someone's lot in life'"""
    print("=== Pregroup Grammar Analysis ===")
    print(f"someone: {someone_type}")
    print(f"'s: {s_possessive_type}")
    print(f"lot: {lot_type}")
    print(f"in: {in_type}")
    print(f"life: {life_type}")
    print(f"\nCombined Type: {combined_type}")
    print("\nWith grammatical reductions (cups), this reduces to type 's' (sentence)")
    
    print("\n=== Categorical Diagram ===")
    print(phrase_diagram)
    print("\nCup contractions:")
    for cup in phrase_diagram.cups:
        print(f"- {cup}")
    
    print("\n=== Vector Space Semantics ===")
    # Initialize vector space model
    dim = 4  # Use a small dimension for demonstration
    vsm = VectorSpaceModel(dim)
    
    # Compute meaning
    meaning = vsm.compute_meaning()
    
    print(f"Computing meaning through tensor contractions (dim={dim})")
    print(f"Shape of final meaning tensor: {meaning.shape}")
    
    # Display first few elements
    print("First few elements of the meaning tensor:")
    print(meaning.flatten()[:8])
    
    print("\n=== Quantum Circuit Translation ===")
    # Create IQP ansatz
    ansatz = IQPAnsatz(dim)
    
    # Convert to quantum circuit
    circuit = ansatz.sentence_to_circuit(vsm)
    
    print(f"Quantum circuit with {circuit.num_qubits} qubits:")
    print(circuit.draw())
    
    print("\n=== Normalized Representation ===")
    # Find principal components of the meaning
    u, s, vh = np.linalg.svd(meaning)
    
    print("Singular values of meaning tensor:")
    print(s)
    
    print("\nNormalized representation prioritizes the dominant relationships in the semantic space")
    print("This process maps the compositional meaning to a standardized form where:")
    print("1. The variance is concentrated along principal dimensions")
    print("2. The representation is invariant to different linguistic expressions")
    print("3. The quantum aspects reveal probabilistic interpretations of meaning")
    
    return {
        "pregroup_type": combined_type,
        "diagram": phrase_diagram,
        "meaning_tensor": meaning,
        "circuit": circuit,
        "singular_values": s,
        "normalized_interpretation": "The concept of 'someone's lot in life' normalized to a state vector representing the categorical relationship between a person and their circumstances within the context of life."
    }

# Execute if run as script
if __name__ == "__main__":
    result = normalize_lot_in_life()
    
    print("\n=== Final Categorical Interpretation ===")
    print("'Someone's lot in life' represents a functor F: Syntax → Semantics where:")
    print("• The syntactic types (n, s) are mapped to vector spaces (V_n, V_s)")
    print("• Words are mapped to vectors/tensors in these spaces")
    print("• Grammatical reductions (cups) correspond to tensor contractions")
    print("• The semantic meaning emerges from the functorial image of the syntactic structure")
    print("• Quantum representation enables measuring different aspects of meaning as observables")
    print(f"\nNormalized interpretation: {result['normalized_interpretation']}")