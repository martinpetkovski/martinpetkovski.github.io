class AdjacencyMatrixGraph
{
private:
	vector<vector<bool>> matrix;
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
	cout << setfill(' ') << setw(5);
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
	if (matrix[nodeA][nodeB])
		matrix[nodeA][nodeB] = 0;
	if (matrix[nodeB][nodeA])
		matrix[nodeB][nodeA] = 0;
}

int AdjacencyMatrixGraph::matrix_size()
{
	return matrix.size();
}