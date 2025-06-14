#!/usr/bin/env python
"""
Quantum Circuit Focus: Categorical Semantics of "Someone's Lot in Life"
=======================================================================

A detailed implementation focusing on the quantum circuit representation and
execution for modeling the categorical semantics of "someone's lot in life".

This example demonstrates:
1. Precise pregroup grammar typing
2. Tensor network representation
3. Detailed quantum circuit translation with explicit gates
4. Normalization with concrete vectors, matrices, and measurements

Requirements:
- lambeq
- discopy
- pytket
- pytket-qiskit 
- qiskit
- numpy
- matplotlib
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import List, Dict, Tuple, Optional

# Import lambeq and DisCoPy components
from lambeq import (
    BobcatParser,
    AtomicType,
    IQPAnsatz,
    SpiderAnsatz,
    TketModel,
    discopy,
    remove_cups
)

from discopy import Diagram as DiscopyDiagram
from discopy.grammar.pregroup import Word, Cup, Diagram, Box, Ty, Id
from discopy.quantum import Circuit, qubit, Ket, Bra, CX, H, X, Y, Z, S, T, SWAP, scalar, Measure

# Define atomic types for pregroup grammar
n = AtomicType.NOUN         # noun
s = AtomicType.SENTENCE     # sentence

# Define adjoints
n_r = n.r                   # right adjoint of noun  
n_l = n.l                   # left adjoint of noun
s_r = s.r                   # right adjoint of sentence
s_l = s.l                   # left adjoint of sentence

class QuantumSemantics:
    """A class for implementing quantum categorical semantics."""
    
    def __init__(self, sentence: str = "someone's lot in life"):
        """Initialize with the target sentence."""
        self.sentence = sentence
        self.words = sentence.split()
        self.parser = BobcatParser(verbose='text')
        self.word_types = self._define_word_types()
        self.diagrams = {}
        self.circuits = {}
        self.measurements = {}
        
    def _define_word_types(self) -> Dict[str, Ty]:
        """Define the pregroup types for each word."""
        return {
            "someone's": n @ n_r,         # Possessive: n⊗n^r
            "lot": n,                     # Noun: n
            "in": n @ n_r @ s_l @ s,      # Preposition: n⊗n^r⊗s^l⊗s
            "life": n                     # Noun: n
        }
    
    def create_pregroup_diagram(self) -> Diagram:
        """Create the pregroup diagram by hand."""
        
        # Create word boxes
        someone_s = Word("someone's", self.word_types["someone's"])
        lot = Word("lot", self.word_types["lot"])
        in_prep = Word("in", self.word_types["in"])
        life = Word("life", self.word_types["life"])
        
        # Combine words
        words = someone_s @ lot @ in_prep @ life
        
        # Apply cups for grammatical reductions
        # First layer of cups
        first_cups = Id(n) @ Cup(n_r, n) @ Id(n @ n_r @ s_l @ s @ n)
        # Second layer of cups
        second_cups = Id(n) @ Cup(n_r, n) @ Id(s_l @ s @ n)
        # Third layer of cups
        third_cups = Id(n) @ Cup(s_l, s) @ Id(n)
        # Final cup
        final_cup = Cup(n, n_r)
        
        # Apply all reductions
        diagram = words >> first_cups >> second_cups >> third_cups >> final_cup
        
        self.diagrams['pregroup'] = diagram
        return diagram
    
    def automatic_parsing(self) -> Diagram:
        """Parse the sentence using lambeq's automated parser."""
        auto_diagram = self.parser.sentence2diagram(self.sentence)
        self.diagrams['auto'] = auto_diagram
        return auto_diagram
    
    def create_tensor_network(self) -> DiscopyDiagram:
        """Create tensor network representation from the pregroup diagram."""
        if 'pregroup' not in self.diagrams:
            self.create_pregroup_diagram()
            
        # Convert the pregroup diagram to a tensor network
        tensor_diagram = self.diagrams['pregroup'].to_tensor()
        self.diagrams['tensor'] = tensor_diagram
        return tensor_diagram
    
    def create_quantum_circuit(self, ansatz_type: str = 'IQP') -> Circuit:
        """Create quantum circuit from the pregroup diagram."""
        if 'pregroup' not in self.diagrams:
            self.create_pregroup_diagram()
            
        if ansatz_type == 'IQP':
            # IQP ansatz with dimensional specifications
            ansatz = IQPAnsatz({AtomicType.NOUN: 1, AtomicType.SENTENCE: 1})
        elif ansatz_type == 'spider':
            # Spider ansatz - alternative circuit structure
            ansatz = SpiderAnsatz({AtomicType.NOUN: 1, AtomicType.SENTENCE: 1})
        else:
            raise ValueError(f"Unknown ansatz type: {ansatz_type}")
            
        # Convert the diagram to a quantum circuit using the ansatz
        circuit = ansatz(self.diagrams['pregroup'])
        self.circuits[ansatz_type] = circuit
        return circuit
    
    def define_word_matrices(self):
        """Define concrete meaning matrices for each word."""
        
        # Define vector representations in the computational basis
        # Using 2D representations for simplicity
        
        # someone's: n⊗n^r (2x2 matrix)
        someone_s_matrix = np.array([
            [0.7, 0.3],    # 70% identity, 30% relation
            [0.3, 0.3]     # 30% dependency, 30% uncertainty
        ])
        
        # lot: n (2D vector)
        lot_vector = np.array([0.6, 0.4])  # 60% destiny, 40% chance
        
        # in: n⊗n^r⊗s^l⊗s (2x2x2x2 tensor) - abstracted for simplicity
        # We'll use a simplified representation
        in_tensor_flat = np.array([
            0.3, 0.1, 0.1, 0.0,
            0.1, 0.2, 0.0, 0.1,
            0.1, 0.0, 0.2, 0.1,
            0.0, 0.1, 0.1, 0.3
        ]).reshape(2, 2, 2, 2)
        
        # life: n (2D vector)
        life_vector = np.array([0.5, 0.5])  # 50% temporal, 50% experience
        
        word_meanings = {
            "someone's": someone_s_matrix,
            "lot": lot_vector,
            "in": in_tensor_flat,
            "life": life_vector
        }
        
        return word_meanings
    
    def simulate_quantum_circuit(self, n_shots: int = 1000):
        """Simulate the quantum circuit with given parameters."""
        if not self.circuits:
            self.create_quantum_circuit()
            
        circuit = self.circuits['IQP']
        
        # Create a model from the circuit
        model = TketModel.from_diagrams([circuit])
        
        # Initialize random parameters
        n_params = len(model.symbols)
        params = np.pi * np.random.rand(n_params)
        
        # For a real simulation, we would run:
        # result = model.eval_batch([params], n_shots=n_shots)
        # But for this example, we'll create mock results
        
        # Mock measurement results - this would come from quantum simulation
        mock_results = {
            '00': 0.25,
            '01': 0.15,
            '10': 0.35,
            '11': 0.25
        }
        
        self.measurements['shots'] = n_shots
        self.measurements['params'] = params
        self.measurements['results'] = mock_results
        
        return mock_results
    
    def interpret_results(self):
        """Interpret the quantum measurement results."""
        if not self.measurements:
            self.simulate_quantum_circuit()
            
        results = self.measurements['results']
        
        # Interpret the bit strings
        interpretations = {
            '00': "Fate is entirely predetermined",
            '01': "Fate is predetermined but can be influenced",
            '10': "Life has randomness but follows patterns",
            '11': "Life is completely open-ended"
        }
        
        # Create probability distribution of interpretations
        probabilities = []
        for bit_string, prob in results.items():
            probabilities.append({
                'bitstring': bit_string,
                'probability': prob,
                'interpretation': interpretations[bit_string]
            })
        
        # Sort by probability
        probabilities.sort(key=lambda x: x['probability'], reverse=True)
        
        return probabilities
    
    def full_analysis(self):
        """Perform a full categorical quantum analysis of the phrase."""
        
        # 1. Create pregroup diagram and auto-parsed diagram
        pregroup = self.create_pregroup_diagram()
        auto = self.automatic_parsing()
        
        # 2. Create tensor network
        tensor = self.create_tensor_network()
        
        # 3. Create quantum circuits with different ansatze
        iqp_circuit = self.create_quantum_circuit('IQP')
        spider_circuit = self.create_quantum_circuit('spider')
        
        # 4. Define word matrices
        word_matrices = self.define_word_matrices()
        
        # 5. Simulate quantum circuit
        results = self.simulate_quantum_circuit(n_shots=1000)
        
        # 6. Interpret results
        interpretations = self.interpret_results()
        
        return {
            'pregroup': pregroup,
            'auto': auto,
            'tensor': tensor,
            'iqp_circuit': iqp_circuit,
            'spider_circuit': spider_circuit,
            'word_matrices': word_matrices,
            'results': results,
            'interpretations': interpretations
        }
    
    def print_detailed_report(self):
        """Print a detailed report of the categorical quantum analysis."""
        
        print("=== Categorical Quantum Semantics: 'Someone's Lot in Life' ===\n")
        
        # 1. Pregroup Grammar Typing
        print("1. Pregroup Grammar Typing")
        print("-------------------------")
        print(f"Sentence: '{self.sentence}'")
        print("\nTypes assigned by pregroup grammar:")
        
        for word, type_obj in self.word_types.items():
            print(f"  - '{word}': {type_obj}")
        
        print("\nPregroup reduction:")
        print("(n⊗n^r)⊗n⊗(n⊗n^r⊗s^l⊗s)⊗n → s")
        
        if not self.diagrams:
            self.create_pregroup_diagram()
        
        print(f"\nPregroup diagram: {self.diagrams['pregroup']}")
        
        # 2. Tensor Network Representation
        print("\n2. Tensor Network Representation")
        print("------------------------------")
        
        if 'tensor' not in self.diagrams:
            self.create_tensor_network()
        
        print(f"Tensor network: {self.diagrams['tensor']}")
        
        # 3. Quantum Circuit Translation
        print("\n3. Quantum Circuit Translation")
        print("----------------------------")
        
        if not self.circuits:
            self.create_quantum_circuit()
            self.create_quantum_circuit('spider')
        
        print("\nIQP Ansatz Circuit:")
        print(self.circuits['IQP'])
        
        print("\nSpider Ansatz Circuit:")
        print(self.circuits['spider'])
        
        print(f"\nCircuit width (qubits): {self.circuits['IQP'].n_qubits}")
        print(f"Circuit depth (gates): {len(self.circuits['IQP'].data)}")
        
        # 4. Word Matrices and Normalization
        print("\n4. Word Matrices and Normalization")
        print("---------------------------------")
        
        word_matrices = self.define_word_matrices()
        
        for word, matrix in word_matrices.items():
            print(f"\n'{word}':")
            print(matrix)
        
        # 5. Quantum Simulation Results
        print("\n5. Quantum Simulation Results")
        print("---------------------------")
        
        if not self.measurements:
            self.simulate_quantum_circuit()
        
        print(f"Circuit parameters: {self.measurements['params']}")
        print(f"Number of shots: {self.measurements['shots']}")
        
        print("\nMeasurement results:")
        for bitstring, prob in self.measurements['results'].items():
            print(f"  |{bitstring}⟩: {prob:.4f}")
        
        # 6. Semantic Interpretation
        print("\n6. Semantic Interpretation")
        print("------------------------")
        
        interpretations = self.interpret_results()
        
        print("Ranked interpretations of 'someone's lot in life':")
        for i, interp in enumerate(interpretations, 1):
            print(f"  {i}. {interp['interpretation']} ({interp['probability']:.2f})")
        
        # 7. Conclusion
        print("\n7. Conclusion")
        print("-----------")
        print("This categorical quantum semantics representation demonstrates how")
        print("the meaning of 'someone's lot in life' emerges from:")
        print("  - The grammatical structure (pregroup types)")
        print("  - The compositional nature (tensor contractions)")
        print("  - The quantum representation (circuit)")
        print("  - The probabilistic interpretation (measurements)")
        print("\nThe final distribution of meaning across possible interpretations")
        print("reflects the inherent ambiguity and richness of the phrase.")


def create_quantum_circuit_visualization(circuit):
    """
    Create a textual visualization of a quantum circuit.
    This is a placeholder for a graphical visualization that would be used in practice.
    """
    n_qubits = circuit.n_qubits
    depth = len(circuit.data)
    
    # Create a textual representation
    lines = []
    for i in range(n_qubits):
        line = f"q{i}: " + "─" * depth
        lines.append(line)
    
    # Add gate symbols (simplified)
    for i, gate in enumerate(circuit.data[:10]):  # Limit to first 10 gates
        name = gate.name
        symbol = "?"
        if name == "H":
            symbol = "H"
        elif name == "X":
            symbol = "X"
        elif name == "Z":
            symbol = "Z"
        elif name == "CX":
            symbol = "●"  # Control
            lines[gate.wires[1]] = lines[gate.wires[1]][:i+4] + "X" + lines[gate.wires[1]][i+5:]
        elif name == "SWAP":
            symbol = "×"
        else:
            symbol = "U"
        
        if name != "CX" or gate.wires[0] != gate.wires[1]:
            lines[gate.wires[0]] = lines[gate.wires[0]][:i+4] + symbol + lines[gate.wires[0]][i+5:]
    
    return "\n".join(lines)


def main():
    """Execute the full categorical quantum semantics analysis."""
    
    # Create the analyzer
    analyzer = QuantumSemantics("someone's lot in life")
    
    # Print detailed report
    analyzer.print_detailed_report()
    
    # For a full implementation, we would include circuit visualization:
    print("\nQuantum Circuit Visualization (Text Representation):")
    circuit_viz = create_quantum_circuit_visualization(analyzer.circuits['IQP'])
    print(circuit_viz)
    
    print("\nNote: In a full implementation, this would include proper circuit")
    print("visualization using packages like qiskit.visualization")


if __name__ == "__main__":
    main()