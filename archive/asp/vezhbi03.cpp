#include<iostream>
#include<iomanip>
#include<vector>
#include<algorithm>
#include<queue>
using namespace std;

////////////////////////////////////////////////////////
//													  //
// ????????????? ?? ??????? ?? ??????? ?? ?????????   //
//													  //
////////////////////////////////////////////////////////

class AdjacencyMatrixGraph // ??? ????????? ????
{
private:
	vector<vector<bool>> matrix; // bool ? 1 ????, int ? 4 ?????
public:
	AdjacencyMatrixGraph(vector<vector<bool>> initial_matrix);
	void print();
	vector<int> get_connections_from_node(int node_index);
	vector<int> get_connections_to_node(int node_index);
	void add_node(vector<int> connections);
	void establish_connection(int nodeA, int nodeB);
	void remove_connection(int nodeA, int nodeB);
	int matrix_size();
};

AdjacencyMatrixGraph::AdjacencyMatrixGraph(vector<vector<bool>> initial_matrix)
{
	this->matrix = initial_matrix;
}

void AdjacencyMatrixGraph::print()
{
	cout << setfill(' ') << setw(5); // setw ? setfill ?? ?????a? ?? iomanip ???????
	for (int i = 0; i < matrix.size(); i++)
	{
		cout << i << " ";
	}
	cout << "\n" << setfill('-') << setw(matrix.size() * 2 + 4);
	cout << "\n";

	for (int i = 0; i < matrix.size(); i++)
	{
		cout << i << " | ";
		for (int j = 0; j < matrix[i].size(); j++)
		{
			cout << matrix[i][j] << " ";
		}
		cout << endl;
	}
	system("pause");
}

vector<int> AdjacencyMatrixGraph::get_connections_from_node(int node_index)
{
	vector<int> result;
	for (int i = 0; i < matrix[node_index].size(); i++)
	{
		if (matrix[node_index][i] == 1)
			result.push_back(matrix[node_index][i]);
	}

	return result;
}

vector<int> AdjacencyMatrixGraph::get_connections_to_node(int node_index)
{
	return get_connections_from_node(node_index);
}

void AdjacencyMatrixGraph::add_node(vector<int> connections)
{
	vector<bool> temp_zeros(matrix.size());
	matrix.push_back(temp_zeros);
	for (int i = 0; i < matrix.size(); i++)
	{
		matrix[i].push_back(0);
	}

	int current_node = matrix.size() - 1;
	for (int i = 0; i < connections.size(); i++)
	{
		establish_connection(connections[i], current_node);
	}
}

void AdjacencyMatrixGraph::establish_connection(int nodeA, int nodeB)
{
	if (matrix[nodeA][nodeB])
		matrix[nodeA][nodeB] = 1;
	if (matrix[nodeB][nodeA])
		matrix[nodeB][nodeA] = 1;
}

void AdjacencyMatrixGraph::remove_connection(int nodeA, int nodeB)
{
	if(matrix[nodeA][nodeB])
		matrix[nodeA][nodeB] = 0;
	if(matrix[nodeB][nodeA])
		matrix[nodeB][nodeA] = 0;
}

int AdjacencyMatrixGraph::matrix_size()
{
	return matrix.size();
}
//////////////////////////////////////////////////////
//													//
// ????????????? ?? ??????? ?? ????? ?? ?????????   //
//													//
//////////////////////////////////////////////////////

class AdjacencyListGraph // ??? ??????? ????
{
private:
	vector<vector<int>> adj_list;
public:
	AdjacencyListGraph(vector<vector<int>> initial_list);
	void print();
	void add_node(vector<int> connections);
	vector<int> get_connections_from_node(int node_index);
	vector<int> get_connections_to_node(int node_index);
	void establish_connection(int nodeA, int nodeB);
	void remove_connection(int nodeA, int nodeB);
	int ajd_list_size();
};

AdjacencyListGraph::AdjacencyListGraph(vector<vector<int>> initial_list)
{
	this->adj_list = initial_list;
}

void AdjacencyListGraph::print()
{
	for (int i = 0; i < adj_list.size(); i++)
	{
		cout << i << " | ";
		for (int j = 0; j < adj_list[i].size(); j++)
		{
			cout << adj_list[i][j] << " ";
		}
		cout << endl;
	}
	system("pause");
}

void AdjacencyListGraph::add_node(vector<int> connections)
{
	adj_list.push_back(connections);
}

vector<int> AdjacencyListGraph::get_connections_from_node(int node_index)
{
	return adj_list[node_index];
}

vector<int> AdjacencyListGraph::get_connections_to_node(int node_index)
{
	vector<int> connections_to_node; 
	for (int i = 0; i < adj_list.size(); i++)
	{
		vector<int> current_node_connections = get_connections_from_node(i);
		if (find(current_node_connections.begin(), current_node_connections.end(), node_index) != current_node_connections.end())
			connections_to_node.push_back(i);
	}

	return connections_to_node;
}

void AdjacencyListGraph::establish_connection(int nodeA, int nodeB)
{
	adj_list[nodeA].push_back(nodeB);
}

void AdjacencyListGraph::remove_connection(int nodeA, int nodeB)
{
	for (int i = 0; i < adj_list[nodeA].size(); i++)
	{
		if (adj_list[nodeA][i] == nodeB)
		{
			swap(adj_list[nodeA][i], adj_list[nodeA][adj_list[nodeA].size() - 1]);
			adj_list[nodeA].pop_back();
		}
	}
}

int AdjacencyListGraph::ajd_list_size()
{
	return adj_list.size();
}

/////////////////////////////////
//							   //
//	Depth First Search		   //
//							   //
/////////////////////////////////
void print_vector(vector<int> vector_to_print)
{
	for (int i = 0; i < vector_to_print.size(); i++)
	{
		cout << vector_to_print[i] << " ";
	}

	system("pause");
}

bool is_marked(vector<int> marked, int node_index)
{
	return find(marked.begin(), marked.end(), node_index) != marked.end();
}

vector<int> DFS(AdjacencyListGraph alg, int root_node)
{
	vector<int> the_stack;
	vector<int> marked;
	
	the_stack.push_back(root_node);
	while (the_stack.size() > 0)
	{
		root_node = the_stack.back();
		the_stack.pop_back();
		if (!is_marked(marked, root_node))
		{
			marked.push_back(root_node);
			vector<int> current_node_connections = alg.get_connections_from_node(root_node);
			for (int i = 0; i < current_node_connections.size(); i++)
			{
				if (!is_marked(marked, current_node_connections[i]))
				{
					the_stack.push_back(current_node_connections[i]);
				}
			}
		}
	}

	return marked;
}

/////////////////////////////////
//							   //
//	Breadth First Search	   //
//							   //
/////////////////////////////////

vector<int> BFS(AdjacencyListGraph alg, int root_node)
{
	queue<int> the_queue;
	vector<int> marked;

	the_queue.push(root_node);

	while (the_queue.size() > 0)
	{
		root_node = the_queue.front();
		the_queue.pop();
		
		if (!is_marked(marked, root_node))
		{
			vector<int> current_node_connections = alg.get_connections_from_node(root_node);
			marked.push_back(root_node);

			for (int i = 0; i < current_node_connections.size(); i++)
			{
				if (!is_marked(marked, current_node_connections[i]))
				{
					the_queue.push(current_node_connections[i]);
				}
			}
		}
	}

	return marked;
}

///////////////////////////////////////////////////
//											     //
// ????????? ????????? ?? ????????? ??????? ???? //
//                                               //
///////////////////////////////////////////////////

vector<int> find_nodes_with_no_incoming_edges(AdjacencyListGraph alg)
{
	vector<int> nodes_with_no_incoming_edges;
	for (int i = 0; i < alg.ajd_list_size(); i++)
	{
		if (alg.get_connections_to_node(i).size() == 0 && alg.get_connections_from_node(i).size() != 0)
			nodes_with_no_incoming_edges.push_back(i);
	}
	
	return nodes_with_no_incoming_edges;
}

vector<int> topological_sort(AdjacencyListGraph alg)
{
	vector<int> sorted_list;
	vector<int> nodes_with_no_incoming_edges = find_nodes_with_no_incoming_edges(alg);
	
	while (nodes_with_no_incoming_edges.size() > 0)
	{
		int current_node = nodes_with_no_incoming_edges.back();
		nodes_with_no_incoming_edges.pop_back();
		sorted_list.push_back(current_node);

		for (int i = 0; i < alg.ajd_list_size(); i++)
			alg.remove_connection(current_node, i);

		nodes_with_no_incoming_edges = find_nodes_with_no_incoming_edges(alg);
	}

	for (int i = 0; i < alg.ajd_list_size(); i++)
	{
		if (find(sorted_list.begin(), sorted_list.end(), i) == sorted_list.end())
			sorted_list.push_back(i);
	}

	return sorted_list;
}

/////////////////////////////////
// main						   //
/////////////////////////////////
int main()
{
	/*
	
	vector<vector<bool>> amg_vector{ { 0, 0, 0, 0 },
									{ 0, 0, 0, 0 },
									{ 0, 0, 0, 0 },
									{ 0, 0, 0, 0 } }; // C++11
	AdjacencyMatrixGraph amg(amg_vector);
	vector<int> connections_for_new_node{ 0,2 };
	amg.add_node(connections_for_new_node);
	amg.print();
	amg.remove_connection(4, 2);
	amg.print();
	amg.establish_connection(1, 3);
	amg.print();
	amg.remove_connection(3, 1);
	amg.print();

	*/

	/*

	vector<vector<int>> alg_vector{ { 1, 2, 3 },
									{ 0, 2},
									{0, 1, 3},
									{ 0, 1, 2, 4},
									{ 2, 3} };

	AdjacencyListGraph alg(alg_vector);
	alg.print();
	vector<int> connections_for_new_node{ 0,2 };
	alg.add_node(connections_for_new_node);
	alg.print();
	alg.establish_connection(4, 1);
	alg.print();
	alg.remove_connection(2, 3);
	alg.print();
	print_vector(alg.get_connections_to_node(0));
		
	*/

	/*

	vector<vector<int>> alg_vector_dfs { {6, 3, 1},
										 {5, 4, 0},
										 {7, 5},
										 {5, 0},
										 {6, 1},
										 {3, 2, 1},
										 {4, 0},
										 {2} };

	print_vector(DFS(alg_vector_dfs, 0));


	vector<vector<int>> alg_vector_bfs { { 1, 3, 6 },
										 { 0, 4, 5 },
										 { 5, 7 },
										 { 0, 5 },
										 { 1, 6 },
										 { 1, 2, 3 },
										 { 0, 4 },
										 { 2 } };

	print_vector(BFS(alg_vector_bfs, 0));

	*/

	/*

	vector<vector<int>> alg_vector_tsort{   {1,5},
											{3},
											{3,0},
											{4},
											{},
											{1, 3, 4} };

	AdjacencyListGraph alg_tsort(alg_vector_tsort);

	print_vector(topological_sort(alg_tsort));

	*/

	return 0;
}