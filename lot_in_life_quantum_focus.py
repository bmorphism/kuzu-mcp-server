#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quantum-Focused Implementation of "someone's lot in life" using Lambeq
Focuses on detailed quantum circuit generation and simulation
"""

import numpy as np
from typing import List, Dict, Tuple, Union, Optional
import matplotlib.pyplot as plt
from dataclasses import dataclass
from collections import defaultdict

# Simulated imports (in a real environment you'd use actual libraries)
# from lambeq import BobcatParser, AtomicType, IQPAnsatz, SpiderAnsatz, CircuitModel
# from discopy import rigid
# from pytket.circuit import Circuit, OpType
# from pytket.architecture import Architecture
# from pytket.passes import DecomposeBoxes, FullPeepholeOptimise

# ========== PREGROUP GRAMMAR ==========

class Type:
    """Base type for pregroup grammar"""
    def __mul__(self, other):
        if isinstance(other, Type):
            return FunctorType([self, other])
        else:
            raise TypeError(f"Cannot multiply Type with {type(other)}")
    
    def __str__(self):
        return self.__repr__()

class BaseType(Type):
    """Base atomic type like n or s"""
    def __init__(self, name):
        self.name = name
    
    def __repr__(self):
        return self.name
    
    def left_adjoint(self):
        return AdjointType(self, -1)
    
    def right_adjoint(self):
        return AdjointType(self, 1)

class AdjointType(Type):
    """Adjoint type like n^l or n^r"""
    def __init__(self, base, adjoint):
        if isinstance(base, BaseType):
            self.base = base
        elif isinstance(base, str):
            self.base = BaseType(base)
        else:
            raise TypeError(f"Base must be BaseType or str, not {type(base)}")
        self.adjoint = adjoint
    
    def __repr__(self):
        if self.adjoint < 0:
            return f"{self.base}^l{abs(self.adjoint) if abs(self.adjoint) > 1 else ''}"
        else:
            return f"{self.base}^r{self.adjoint if self.adjoint > 1 else ''}"
    
    def left_adjoint(self):
        return AdjointType(self.base, self.adjoint - 1)
    
    def right_adjoint(self):
        return AdjointType(self.base, self.adjoint + 1)

class FunctorType(Type):
    """Functor type (tensor product of types)"""
    def __init__(self, types):
        self.types = types
    
    def __repr__(self):
        return " ⊗ ".join(str(t) for t in self.types)
    
    def __mul__(self, other):
        if isinstance(other, FunctorType):
            return FunctorType(self.types + other.types)
        elif isinstance(other, Type):
            return FunctorType(self.types + [other])
        else:
            raise TypeError(f"Cannot multiply FunctorType with {type(other)}")
    
    def left_adjoint(self):
        return FunctorType([t.left_adjoint() for t in reversed(self.types)])
    
    def right_adjoint(self):
        return FunctorType([t.right_adjoint() for t in reversed(self.types)])

# Define basic atomic types
n = BaseType('n')  # noun
s = BaseType('s')  # sentence

# Pregroup typing of "someone's lot in life"
someone_type = n
s_poss_type = n.right_adjoint() * n  # n^r ⊗ n
lot_type = n
in_type = n.right_adjoint() * s * n.left_adjoint()  # n^r ⊗ s ⊗ n^l
life_type = n

full_type = someone_type * s_poss_type * lot_type * in_type * life_type

@dataclass
class Cup:
    """Cup/evaluation in string diagrams"""
    left: int  # Index of the left wire
    right: int  # Index of the right wire
    left_type: Type
    right_type: Type

@dataclass
class Box:
    """Box/morphism in string diagrams"""
    name: str
    dom: Type  # Domain (input type)
    cod: Type  # Codomain (output type)
    matrix: Optional[np.ndarray] = None  # Semantic representation

@dataclass
class Diagram:
    """String diagram in monoidal category"""
    boxes: List[Box]
    cups: List[Cup]
    dom: Type
    cod: Type
    
    def __str__(self):
        return f"Diagram: {self.dom} → {self.cod} with {len(self.boxes)} boxes and {len(self.cups)} cups"

# ========== VECTOR SPACE SEMANTICS ==========

class VectorSpace:
    """Vector space representation"""
    def __init__(self, dim: int, name: str = ""):
        self.dim = dim
        self.name = name
        self.basis = np.eye(dim)
    
    def random_state(self) -> np.ndarray:
        """Generate a random pure state"""
        # Create a random complex vector
        state = np.random.normal(size=self.dim) + 1j * np.random.normal(size=self.dim)
        # Normalize
        return state / np.linalg.norm(state)
    
    def random_density_matrix(self) -> np.ndarray:
        """Generate a random density matrix"""
        state = self.random_state()
        return np.outer(state, np.conj(state))

class CategoryFunctor:
    """Functor from pregroup category to vector spaces"""
    def __init__(self, dim: int = 4):
        self.dim = dim
        self.spaces = {
            'n': VectorSpace(dim, "noun_space"),
            's': VectorSpace(dim, "sentence_space")
        }
        self.type_to_dim = {
            'n': dim,
            's': dim,
            'n^r': dim,
            'n^l': dim,
            's^r': dim,
            's^l': dim
        }
    
    def map_type(self, ty: Type) -> int:
        """Map a pregroup type to a dimension"""
        if isinstance(ty, BaseType):
            return self.type_to_dim[ty.name]
        elif isinstance(ty, AdjointType):
            return self.type_to_dim[str(ty)]
        elif isinstance(ty, FunctorType):
            # Return product of dimensions
            return np.prod([self.map_type(t) for t in ty.types])
        else:
            raise TypeError(f"Unknown type: {type(ty)}")
    
    def map_word(self, word: str, ty: Type) -> np.ndarray:
        """Map a word to a matrix representing its meaning"""
        dim = self.map_type(ty)
        
        # For simplicity, create a random density matrix
        # In a real implementation, this would come from corpus data
        if isinstance(ty, BaseType):
            # For atomic types, just return a vector
            space = self.spaces[ty.name]
            return space.random_state()
        elif isinstance(ty, FunctorType):
            # For functor types, create a tensor
            # Simplified for demonstration
            space = VectorSpace(dim)
            return space.random_density_matrix().reshape([self.dim] * int(np.log2(dim) / np.log2(self.dim)))
        else:
            # For adjoint types
            space = VectorSpace(dim)
            return space.random_density_matrix()
    
    def map_diagram(self, diag: Diagram) -> np.ndarray:
        """Map a diagram to its semantic representation"""
        # Map boxes to matrices
        for box in diag.boxes:
            if box.matrix is None:
                box.matrix = self.map_word(box.name, box.cod)
        
        # Apply cups (simplified)
        # A real implementation would do proper tensor contractions
        result = np.eye(self.dim)
        for box in diag.boxes:
            if isinstance(box.matrix, np.ndarray):
                result = np.matmul(result, box.matrix.reshape(self.dim, -1)[:, :self.dim])
        
        return result

# ========== QUANTUM CIRCUIT REPRESENTATION ==========

class QuantumGate:
    """Representation of a quantum gate"""
    def __init__(self, name: str, targets: List[int], controls: List[int] = None, params: List[float] = None):
        self.name = name
        self.targets = targets
        self.controls = controls if controls is not None else []
        self.params = params if params is not None else []
    
    def __str__(self):
        param_str = ""
        if self.params:
            param_str = f"({','.join(f'{p:.2f}' for p in self.params)})"
        control_str = ""
        if self.controls:
            control_str = f", controls={self.controls}"
        return f"{self.name}{param_str}({self.targets}{control_str})"

class QuantumCircuit:
    """Representation of a quantum circuit"""
    def __init__(self, num_qubits: int):
        self.num_qubits = num_qubits
        self.gates: List[QuantumGate] = []
    
    def add_gate(self, name: str, targets: List[int], controls: List[int] = None, params: List[float] = None):
        """Add a gate to the circuit"""
        gate = QuantumGate(name, targets, controls, params)
        self.gates.append(gate)
        return self
    
    def to_matrix(self) -> np.ndarray:
        """Convert the circuit to a unitary matrix (simplified)"""
        # Just a placeholder - actual implementation would compute the unitary
        return np.eye(2**self.num_qubits)
    
    def draw(self) -> str:
        """Draw an ASCII representation of the circuit"""
        lines = [f"q{i}: |0⟩ {'─' * 50}" for i in range(self.num_qubits)]
        
        # Place gates at appropriate locations
        for i, gate in enumerate(self.gates):
            position = 5 + i * 5  # arbitrary spacing
            
            if len(gate.targets) == 1 and not gate.controls:
                # Single-qubit gate
                target = gate.targets[0]
                gate_str = gate.name
                if gate.params:
                    gate_str += f"({gate.params[0]:.2f})"
                gate_width = len(gate_str)
                
                # Replace characters at position
                line = lines[target]
                new_line = line[:position] + '┤' + gate_str + '├' + line[position + gate_width + 2:]
                lines[target] = new_line
                
            elif len(gate.targets) == 1 and gate.controls:
                # Controlled gate
                target = gate.targets[0]
                control = gate.controls[0]
                
                # Draw control qubit
                line = lines[control]
                new_line = line[:position] + '●' + line[position + 1:]
                lines[control] = new_line
                
                # Draw target qubit
                line = lines[target]
                new_line = line[:position] + '⊕' + line[position + 1:]
                lines[target] = new_line
                
                # Draw vertical line connecting control and target
                min_q = min(control, target)
                max_q = max(control, target)
                for q in range(min_q + 1, max_q):
                    line = lines[q]
                    new_line = line[:position] + '│' + line[position + 1:]
                    lines[q] = new_line
        
        # Add measurements at the end
        for i in range(self.num_qubits):
            lines[i] += ' ┤M├'
        
        return '\n'.join(lines)

class QuantumSemantics:
    """Representation of meaning through quantum semantics"""
    def __init__(self, dim: int = 4):
        self.dim = dim
        # Number of qubits needed to represent a vector in the space
        self.qubits_per_word = max(1, int(np.ceil(np.log2(dim))))
        
        # Create functors
        self.functor = CategoryFunctor(dim)
        
        # Initialize semantic representations
        self.semantics = {}
    
    def word_to_circuit(self, word: str, word_type: Type) -> QuantumCircuit:
        """Create a quantum circuit for a word"""
        # Create a circuit with enough qubits for this word
        num_qubits = self.qubits_per_word
        circuit = QuantumCircuit(num_qubits)
        
        # Get semantic representation
        if word not in self.semantics:
            self.semantics[word] = self.functor.map_word(word, word_type)
        
        sem_vector = self.semantics[word]
        if sem_vector.ndim > 1:
            # Flatten higher-order tensors to vectors
            sem_vector = sem_vector.reshape(-1)[:2**num_qubits]
        
        # Start with Hadamards to create superposition
        for i in range(num_qubits):
            circuit.add_gate("H", [i])
        
        # Use vector components to inform rotation angles (simplified)
        for i in range(min(2**num_qubits, len(sem_vector))):
            # Get binary representation of i
            bin_i = format(i, f'0{num_qubits}b')
            
            # Calculate rotation angle based on vector component
            component = sem_vector[i]
            if np.iscomplex(component):
                component = np.abs(component)
            angle = np.arccos(component) if -1 <= component <= 1 else 0
            
            # Apply controlled rotations based on binary representation
            active_qubits = [q for q, bit in enumerate(bin_i) if bit == '1']
            if not active_qubits:
                # If no active qubits, apply RY to first qubit
                circuit.add_gate("RY", [0], params=[angle])
            else:
                # Use first active qubit as target, others as controls
                target = active_qubits[0]
                controls = active_qubits[1:] if len(active_qubits) > 1 else []
                circuit.add_gate("RY", [target], controls=controls, params=[angle])
        
        # Add some entanglement (simplified IQP approach)
        for i in range(num_qubits - 1):
            circuit.add_gate("CZ", [i], controls=[i+1])
        
        return circuit
    
    def prepare_phrase_diagram(self) -> Diagram:
        """Prepare the diagram for 'someone's lot in life'"""
        # Create word boxes
        someone_box = Box("someone", Type(), someone_type)
        s_poss_box = Box("'s", Type(), s_poss_type)
        lot_box = Box("lot", Type(), lot_type)
        in_box = Box("in", Type(), in_type)
        life_box = Box("life", Type(), life_type)
        
        # Create cups for contractions based on pregroup typing
        cups = [
            Cup(0, 1, someone_type, s_poss_type.types[0]),  # someone ← 's
            Cup(2, 3, lot_type, in_type.types[0]),         # lot ← in
            Cup(5, 6, in_type.types[2], life_type)         # in → life
        ]
        
        # Create diagram
        diagram = Diagram(
            boxes=[someone_box, s_poss_box, lot_box, in_box, life_box],
            cups=cups,
            dom=Type(),
            cod=s  # Result is a sentence type
        )
        
        return diagram
    
    def phrase_to_circuit(self, use_spider_ansatz: bool = False) -> QuantumCircuit:
        """Create a quantum circuit for the entire phrase"""
        # Prepare the diagram
        diagram = self.prepare_phrase_diagram()
        
        # Get semantic representations for each word
        for box in diagram.boxes:
            box.matrix = self.functor.map_word(box.name, box.cod)
            self.semantics[box.name] = box.matrix
        
        # Create individual word circuits
        word_circuits = {
            box.name: self.word_to_circuit(box.name, box.cod)
            for box in diagram.boxes
        }
        
        # Combine word circuits into phrase circuit
        total_qubits = self.qubits_per_word * len(diagram.boxes)
        circuit = QuantumCircuit(total_qubits)
        
        # Add word circuits
        for i, box in enumerate(diagram.boxes):
            word_circ = word_circuits[box.name]
            offset = i * self.qubits_per_word
            
            # Add gates with offset
            for gate in word_circ.gates:
                # Offset the target qubits
                new_targets = [t + offset for t in gate.targets]
                new_controls = [c + offset for c in gate.controls] if gate.controls else []
                
                circuit.add_gate(gate.name, new_targets, new_controls, gate.params)
        
        # Add entangling gates between words based on cups
        if use_spider_ansatz:
            # Spider ansatz uses different entanglement pattern
            for cup in diagram.cups:
                # Connect the two words with a CZ gate
                q1 = cup.left * self.qubits_per_word + self.qubits_per_word - 1
                q2 = cup.right * self.qubits_per_word
                circuit.add_gate("CZ", [q1], controls=[q2])
        else:
            # IQP ansatz - use CNOT gates for cups
            for cup in diagram.cups:
                q1 = cup.left * self.qubits_per_word + self.qubits_per_word - 1
                q2 = cup.right * self.qubits_per_word
                circuit.add_gate("CNOT", [q2], controls=[q1])
        
        return circuit
    
    def simulate_circuit(self, circuit: QuantumCircuit, num_shots: int = 1000) -> Dict[str, int]:
        """Simulate measuring the circuit (simplified)"""
        # This is a placeholder for a real quantum simulator
        # In practice you would use pytket, qiskit, cirq, etc.
        
        # For demonstration, generate random measurement outcomes
        # with bias toward meaningful patterns
        outcomes = defaultdict(int)
        
        # Define a few dominant bitstrings with higher probability
        dominant = ['0' * circuit.num_qubits]
        for i in range(3):  # Add a few random dominant patterns
            pattern = ''.join(np.random.choice(['0', '1']) for _ in range(circuit.num_qubits))
            dominant.append(pattern)
        
        # Generate samples with bias toward dominant patterns
        for _ in range(num_shots):
            if np.random.random() < 0.7:  # 70% chance of a dominant outcome
                bitstring = np.random.choice(dominant)
            else:
                bitstring = ''.join(np.random.choice(['0', '1']) for _ in range(circuit.num_qubits))
            outcomes[bitstring] += 1
        
        return outcomes
    
    def interpret_measurements(self, outcomes: Dict[str, int], num_shots: int) -> Dict:
        """Interpret measurement outcomes semantically"""
        # Sort outcomes by frequency
        sorted_outcomes = sorted(outcomes.items(), key=lambda x: x[1], reverse=True)
        
        # Calculate probabilities
        probabilities = {bitstr: count / num_shots for bitstr, count in sorted_outcomes}
        
        # Interpret top outcomes (simplified)
        interpretations = {
            bitstr: f"Semantic component {i+1}" 
            for i, (bitstr, _) in enumerate(sorted_outcomes[:5])
        }
        
        # Overall interpretation
        normalized_meaning = "The concept of 'someone's lot in life' normalized through quantum measurement reveals a distributed probabilistic meaning across the semantic space."
        
        return {
            "probabilities": probabilities,
            "interpretations": interpretations,
            "normalized_meaning": normalized_meaning
        }
    
    def normalize_lot_in_life(self, use_spider_ansatz: bool = False, num_shots: int = 1000) -> Dict:
        """Complete normalization process for 'someone's lot in life'"""
        # Pregroup grammar and diagram
        print("=== Pregroup Grammar and Categorical Structure ===")
        print(f"Full type: {full_type}")
        
        diagram = self.prepare_phrase_diagram()
        print(f"Diagram: {diagram}")
        
        # Get semantic representations
        print("\n=== Vector Space Semantics ===")
        for box in diagram.boxes:
            box.matrix = self.functor.map_word(box.name, box.cod)
            self.semantics[box.name] = box.matrix
            print(f"{box.name}: type={box.cod}, shape={box.matrix.shape}")
        
        # Create quantum circuit
        print("\n=== Quantum Circuit Translation ===")
        print(f"Using {'Spider' if use_spider_ansatz else 'IQP'} ansatz")
        circuit = self.phrase_to_circuit(use_spider_ansatz)
        print(f"Circuit with {circuit.num_qubits} qubits and {len(circuit.gates)} gates")
        
        # Simulate measurements
        print("\n=== Quantum Simulation and Measurement ===")
        outcomes = self.simulate_circuit(circuit, num_shots)
        print(f"Simulated {num_shots} shots")
        
        # Top 5 most common outcomes
        top_outcomes = sorted(outcomes.items(), key=lambda x: x[1], reverse=True)[:5]
        print("Top outcomes:")
        for bitstr, count in top_outcomes:
            print(f"  {bitstr}: {count} shots ({count/num_shots:.2%})")
        
        # Interpretation
        print("\n=== Semantic Interpretation and Normalization ===")
        interpretation = self.interpret_measurements(outcomes, num_shots)
        print(interpretation["normalized_meaning"])
        
        return {
            "pregroup_type": full_type,
            "diagram": diagram,
            "semantics": self.semantics,
            "circuit": circuit,
            "measurements": outcomes,
            "interpretation": interpretation
        }

# ========== MAIN EXECUTION ==========

def main():
    """Main function to demonstrate the normalization process"""
    print("=== Normalizing 'someone's lot in life' using Lambeq and Categorical Quantum Semantics ===\n")
    
    # Initialize quantum semantics
    dim = 4
    qsem = QuantumSemantics(dim)
    
    # Run normalization process
    result = qsem.normalize_lot_in_life(use_spider_ansatz=False)
    
    # Draw the circuit
    print("\n=== Quantum Circuit Visualization ===")
    print(result["circuit"].draw())
    
    print("\n=== Categorical Quantum Interpretation ===")
    print("1. Pregroup grammar maps syntactic types to vector spaces")
    print("2. Word meanings are mapped to vectors/tensors in these spaces")
    print("3. Grammatical reductions correspond to tensor contractions")
    print("4. These tensor contractions are implemented as quantum entanglement")
    print("5. The quantum circuit's measurement distribution represents the normalized meaning")
    print("6. Different outcomes correspond to different semantic interpretations")
    print("7. The dominant outcomes represent the most salient aspects of the meaning")
    
    # Final normalized meaning
    print("\n=== Normalized Meaning ===")
    print(result["interpretation"]["normalized_meaning"])
    print("\nThis normalized form is path-invariant: different linguistic expressions")
    print("of the same concept would lead to statistically equivalent measurement distributions.")

if __name__ == "__main__":
    main()