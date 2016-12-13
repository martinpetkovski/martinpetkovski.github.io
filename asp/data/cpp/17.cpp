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